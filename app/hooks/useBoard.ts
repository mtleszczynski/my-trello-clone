'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { nextPosition, PositionUpdate } from '../lib/positions';
import { createSampleData, getDevMockData } from '../lib/sampleData';
import { BoardType, Card, List } from '../types';

type SaveRequest = () => PromiseLike<{ error: { message: string } | null }>;

interface UseBoardOptions {
  user: User | null;
  authLoading: boolean;
  isDevBypass: boolean;
  board: BoardType;
  isArchiveView: boolean;
  // When not empty, lists from both boards (archived or not) are loaded
  search: string;
}

// Number of lists the user has across both boards and archives (null if the check failed)
async function countAllLists(userId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from('lists')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error counting lists:', error);
    return null;
  }
  return count;
}

// Save several position updates in one go and report the first error, if any
function savePositions(
  table: 'cards' | 'lists',
  updates: PositionUpdate[],
  extraFields: Record<string, Record<string, unknown>> = {}
) {
  return Promise.all(
    updates.map((update) =>
      supabase
        .from(table)
        .update({ position: update.position, ...extraFields[update.id] })
        .eq('id', update.id)
    )
  ).then((results) => ({ error: results.find((result) => result.error)?.error ?? null }));
}

// The board's lists and cards: loading them, and every change to them.
// Changes update the screen immediately (optimistic updates), then save in the background.
export function useBoard({ user, authLoading, isDevBypass, board, isArchiveView, search }: UseBoardOptions) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bumped to re-fetch the board (e.g. when the tab becomes visible again)
  const [refreshCount, setRefreshCount] = useState(0);

  // Saves run one at a time, in order, so a later change can never be overwritten by an earlier one.
  // Fetches wait for this queue so they never show data from before our own saves finished.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const hasInitiallyLoaded = useRef(false);
  const isCreatingSampleData = useRef(false);

  // Queue a database write. Failures are shown to the user instead of silently ignored.
  // Resolves to whether the save worked. Skipped in dev bypass mode.
  function enqueueSave(what: string, save: SaveRequest): Promise<boolean> {
    if (isDevBypass) return Promise.resolve(true);

    const result = saveQueue.current.then(async () => {
      const { error } = await save();
      if (error) {
        console.error(`Error ${what}:`, error);
        setSaveError(`Something went wrong ${what}. It wasn't saved.`);
        return false;
      }
      return true;
    });
    saveQueue.current = result.then(() => undefined);
    return result;
  }

  function reload() {
    setSaveError(null);
    setRefreshCount((count) => count + 1);
  }

  // Re-fetch when coming back to the tab, so changes made on another device show up
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setRefreshCount((count) => count + 1);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fetch lists from Supabase when the page loads (only when user is logged in)
  const userId = user?.id;
  useEffect(() => {
    // Set when a newer fetch starts, so an older, slower response can't overwrite it
    let isStale = false;

    async function fetchLists() {
      if (!userId) {
        setLists([]);
        setLoading(false);
        return;
      }

      // In dev bypass mode, use mock data instead of querying Supabase
      if (isDevBypass) {
        if (!hasInitiallyLoaded.current) {
          setLists(getDevMockData(board));
          hasInitiallyLoaded.current = true;
        }
        setLoading(false);
        return;
      }

      // Only show loading screen on initial load, not when searching
      if (!hasInitiallyLoaded.current) {
        setLoading(true);
      }
      setError(null);

      // Let our own pending saves finish first, otherwise we'd load the old order
      await saveQueue.current;
      if (isStale) return;

      let query = supabase.from('lists').select('*, cards(*)').eq('user_id', userId);
      if (!search.trim()) {
        // Lists on this board, plus shared lists from the other board
        query = query.or(`board.eq.${board},shared.eq.true`).eq('archived', isArchiveView);
      }

      const { data, error } = await query.order('position', { ascending: true });
      if (isStale) return;

      if (error) {
        console.error('Error fetching lists:', error);
        setError('Failed to load lists. Please try again.');
        setLoading(false);
        return;
      }

      // Brand-new user (no lists anywhere, including the other board and archives): create sample data
      const isNewUser =
        !search.trim() &&
        board === 'work' &&
        !isArchiveView &&
        (data || []).length === 0 &&
        !isCreatingSampleData.current &&
        (await countAllLists(userId)) === 0;
      if (isStale) return;

      if (isNewUser) {
        isCreatingSampleData.current = true;
        const sampleData = await createSampleData(userId);
        isCreatingSampleData.current = false;
        if (sampleData) {
          setLists(sampleData);
        }
      } else {
        setLists(data || []);
      }

      hasInitiallyLoaded.current = true;
      setLoading(false);
    }

    if (!authLoading) {
      fetchLists();
    }

    return () => {
      isStale = true;
    };
    // Depends on the user's id rather than the user object: Supabase creates a new user
    // object on every token refresh
  }, [userId, authLoading, isDevBypass, board, isArchiveView, search, refreshCount]);

  // ---- Saving changes ----

  function saveChanges(table: 'cards' | 'lists', id: string, changes: Partial<Card> | Partial<List>, what: string) {
    return enqueueSave(what, () => supabase.from(table).update(changes).eq('id', id));
  }

  // Change a card: update the screen right away, then save
  function updateCard(cardId: string, changes: Partial<Card>, what: string) {
    setLists((prevLists) =>
      prevLists.map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) => (card.id === cardId ? { ...card, ...changes } : card)),
      }))
    );
    return saveChanges('cards', cardId, changes, what);
  }

  // Change a list that stays on this board
  function updateList(listId: string, changes: Partial<List>, what: string) {
    setLists((prevLists) => prevLists.map((l) => (l.id === listId ? { ...l, ...changes } : l)));
    return saveChanges('lists', listId, changes, what);
  }

  // Change a list in a way that takes it off this board (archive, unarchive, move to other board)
  function removeListFromView(listId: string, changes: Partial<List>, what: string) {
    setLists((prevLists) => prevLists.filter((l) => l.id !== listId));
    return saveChanges('lists', listId, changes, what);
  }

  // Create a new list at the end of the board. Resolves to whether it worked.
  async function createList(title: string): Promise<boolean> {
    if (!title.trim() || !user || isArchiveView) return false;

    const newList = {
      title: title.trim(),
      position: nextPosition(lists),
      width: 300,
      archived: false,
      board,
      shared: false,
      minimized: false,
      user_id: user.id,
    };

    if (isDevBypass) {
      const mockList: List = { ...newList, id: `mock-list-${Date.now()}`, created_at: new Date().toISOString(), cards: [] };
      setLists((prevLists) => [...prevLists, mockList]);
      return true;
    }

    const { data, error } = await supabase.from('lists').insert(newList).select().single();
    if (error) {
      console.error('Error creating list:', error);
      setSaveError("Couldn't add the list.");
      return false;
    }

    setLists((prevLists) => [...prevLists, { ...data, cards: [] }]);
    return true;
  }

  // Create a new card at the bottom of a list
  async function createCard(listId: string, title: string) {
    const list = lists.find((l) => l.id === listId);
    if (!list || !user) return;

    const newCard = {
      title: title.trim(),
      list_id: listId,
      position: nextPosition(list.cards || []),
      completed: false,
      description: '',
      user_id: user.id,
    };

    let created: Card = { ...newCard, id: `mock-card-${Date.now()}`, created_at: new Date().toISOString() };
    if (!isDevBypass) {
      const { data, error } = await supabase.from('cards').insert(newCard).select().single();
      if (error) {
        console.error('Error creating card:', error);
        setSaveError("Couldn't add the card.");
        return;
      }
      created = data;
    }

    setLists((prevLists) =>
      prevLists.map((l) => (l.id === listId ? { ...l, cards: [...(l.cards || []), created] } : l))
    );
  }

  function deleteCard(cardId: string, listId: string) {
    setLists((prevLists) =>
      prevLists.map((l) =>
        l.id === listId ? { ...l, cards: (l.cards || []).filter((c) => c.id !== cardId) } : l
      )
    );
    enqueueSave('deleting the card', () => supabase.from('cards').delete().eq('id', cardId));
  }

  function setArchived(listId: string, archived: boolean) {
    removeListFromView(listId, { archived }, archived ? 'archiving the list' : 'unarchiving the list');
  }

  function moveList(listId: string, targetBoard: BoardType) {
    const list = lists.find((l) => l.id === listId);
    if (!list || list.board === targetBoard) return;
    removeListFromView(listId, { board: targetBoard }, 'moving the list to another board');
  }

  function toggleShared(listId: string) {
    const list = lists.find((l) => l.id === listId);
    if (list) updateList(listId, { shared: !list.shared }, 'sharing the list');
  }

  function toggleMinimized(listId: string) {
    const list = lists.find((l) => l.id === listId);
    if (list) updateList(listId, { minimized: !list.minimized }, 'minimizing the list');
  }

  function renameList(listId: string, title: string) {
    updateList(listId, { title }, 'renaming the list');
  }

  // Called on every mouse move while resizing: screen only
  function resizeList(listId: string, width: number) {
    setLists((prevLists) => prevLists.map((l) => (l.id === listId ? { ...l, width } : l)));
  }

  // Called once when resizing ends: save
  function resizeListEnd(listId: string, width: number) {
    // The width column is an INTEGER, so round to avoid save failures
    saveChanges('lists', listId, { width: Math.round(width) }, 'resizing the list');
  }

  // Resolves to whether the save worked
  function saveCardDetails(cardId: string, title: string, description: string) {
    return updateCard(cardId, { title, description }, 'saving the card details');
  }

  function toggleComplete(cardId: string) {
    const card = lists.flatMap((l) => l.cards || []).find((c) => c.id === cardId);
    if (card) updateCard(cardId, { completed: !card.completed }, 'ticking off the card');
  }

  // Save positions after a drag (the screen is already updated by the drag code)
  function saveCardPositions(updates: PositionUpdate[], movedCardId: string, listId: string) {
    enqueueSave('moving the card', () => savePositions('cards', updates, { [movedCardId]: { list_id: listId } }));
  }

  function saveListPositions(updates: PositionUpdate[]) {
    enqueueSave('reordering the lists', () => savePositions('lists', updates));
  }

  return {
    lists,
    setLists,
    loading,
    error,
    saveError,
    dismissSaveError: () => setSaveError(null),
    reload,
    createList,
    createCard,
    deleteCard,
    setArchived,
    moveList,
    toggleShared,
    toggleMinimized,
    renameList,
    resizeList,
    resizeListEnd,
    saveCardDetails,
    toggleComplete,
    saveCardPositions,
    saveListPositions,
  };
}
