'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  CollisionDetection,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from './lib/supabase';
import {
  sortByPosition,
  nextPosition,
  positionBetween,
  repositionAfterMove,
  applyPositionUpdates,
  PositionUpdate,
} from './lib/positions';
import { List as ListType, Card as CardType, BoardType } from './types';
import SortableList from './components/SortableList';
import CardDetailsModal from './components/CardDetailsModal';
import { useAuth } from './components/AuthProvider';

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, signOut, isDevBypass } = useAuth();
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for view mode (board + archive status)
  type ViewMode = 'work' | 'personal' | 'work-archive' | 'personal-archive';
  const [viewMode, setViewMode] = useState<ViewMode>('work');
  
  // Helper to get board and archived status from viewMode
  const getCurrentBoard = (): BoardType => viewMode.startsWith('personal') ? 'personal' : 'work';
  const isArchiveView = viewMode.includes('archive');
  
  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  // The search the board actually shows: follows the input once typing pauses
  const [activeSearch, setActiveSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setActiveSearch(searchQuery), searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // State for adding a new list
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  // State for tracking the currently dragged item
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [activeCardListWidth, setActiveCardListWidth] = useState<number>(300);
  const [activeList, setActiveList] = useState<ListType | null>(null);
  
  // State for card details modal
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  
  // Board as it was when the current drag started (restored if the drag is cancelled)
  const dragSnapshot = useRef<ListType[] | null>(null);

  // Saves run one at a time, in order, so a later change can never be overwritten by an earlier one.
  // Fetches wait for this queue so they never show data from before our own saves finished.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState<string | null>(null);

  // Bumped to re-fetch the board (e.g. when the tab becomes visible again)
  const [refreshCount, setRefreshCount] = useState(0);
  
  // Prevent duplicate sample data creation
  const isCreatingSampleData = useRef(false);

  // Drag-to-scroll for the board
  const boardRef = useRef<HTMLElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  // Set up drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold to start drag on touch
        tolerance: 5,
      },
    })
  );

  // Custom collision detection: when dragging a list, only consider list droppables
  // (ignore card droppables so the list SortableContext gets the correct overIndex)
  const customCollisionDetection: CollisionDetection = (args) => {
    const activeId = args.active.id as string;

    if (activeId.startsWith('list-')) {
      // Filter to only list droppables so the sort transform works correctly
      const listContainers = (args.droppableContainers as { id: string | number }[]).filter(
        (container) => (container.id as string).startsWith('list-')
      );
      return closestCorners({
        ...args,
        droppableContainers: listContainers as typeof args.droppableContainers,
      });
    }

    // For cards, use default closestCorners with all droppables
    return closestCorners(args);
  };

  // Queue a database write. Failures are shown to the user instead of silently ignored.
  // Resolves to whether the save worked.
  function enqueueSave(what: string, save: () => PromiseLike<{ error: { message: string } | null }>) {
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

  // Find the list a card is currently in
  function findListIdOfCard(source: ListType[], cardId: string): string | undefined {
    return source.find((list) => (list.cards || []).some((card) => card.id === cardId))?.id;
  }

  // Work out which list (and which card in it, if any) something is being dragged over.
  // The id can be 'list-{id}' (sortable list), '{id}' (list's card area) or a card id.
  function findDropTarget(source: ListType[], overId: string): { listId: string; overCardId: string | null } | null {
    const list = source.find((l) => l.id === overId || `list-${l.id}` === overId);
    if (list) return { listId: list.id, overCardId: null };

    const listId = findListIdOfCard(source, overId);
    return listId ? { listId, overCardId: overId } : null;
  }

  // Create sample data for new users
  async function createSampleData(userId: string) {
    // Sample lists with different widths
    const sampleLists = [
      { title: '📋 To Do', width: 240, position: 0 },
      { title: '🚀 In Progress', width: 300, position: 1 },
      { title: '✅ Completed', width: 240, position: 2 },
      { title: '💡 Ideas & Notes', width: 380, position: 3 },
      { title: '📚 Resources', width: 280, position: 4 },
    ];

    // Create lists
    const { data: createdLists, error: listsError } = await supabase
      .from('lists')
      .insert(sampleLists.map(list => ({ ...list, user_id: userId, archived: false, board: 'work', shared: false, minimized: false })))
      .select();

    if (listsError || !createdLists) {
      console.error('Error creating sample lists:', listsError);
      return null;
    }

    // Sample cards for each list
    const sampleCards = [
      // To Do (4 short items)
      { list_id: createdLists[0].id, title: 'Review weekly goals', position: 0 },
      { list_id: createdLists[0].id, title: 'Reply to emails', position: 1 },
      { list_id: createdLists[0].id, title: 'Schedule team meeting', position: 2 },
      { list_id: createdLists[0].id, title: 'Update project timeline', position: 3 },
      
      // In Progress (3 items, one with description)
      { list_id: createdLists[1].id, title: 'Design new dashboard layout', position: 0, description: 'Focus on mobile responsiveness and accessibility. Check competitor designs for inspiration.' },
      { list_id: createdLists[1].id, title: 'Write documentation', position: 1 },
      { list_id: createdLists[1].id, title: 'Fix login bug', position: 2, description: 'Users on Safari are seeing a timeout error. Need to investigate the auth flow.' },
      
      // Completed (5 items, some completed)
      { list_id: createdLists[2].id, title: 'Set up project repository', position: 0, completed: true },
      { list_id: createdLists[2].id, title: 'Create database schema', position: 1, completed: true },
      { list_id: createdLists[2].id, title: 'Implement user authentication', position: 2, completed: true },
      { list_id: createdLists[2].id, title: 'Deploy to production', position: 3, completed: true },
      { list_id: createdLists[2].id, title: 'Add drag and drop', position: 4 },
      
      // Ideas & Notes (2 longer items with descriptions)
      { list_id: createdLists[3].id, title: 'Add dark mode support', position: 0, description: 'Many users prefer dark mode, especially for apps they use frequently. Consider adding a toggle in the header and saving the preference.' },
      { list_id: createdLists[3].id, title: 'Keyboard shortcuts for power users', position: 1, description: 'Common shortcuts: N for new card, L for new list, arrow keys to navigate, Enter to edit, Escape to cancel.' },
      
      // Resources (6 items)
      { list_id: createdLists[4].id, title: 'React documentation', position: 0 },
      { list_id: createdLists[4].id, title: 'Tailwind CSS cheatsheet', position: 1 },
      { list_id: createdLists[4].id, title: 'Supabase guides', position: 2, description: 'Check out the auth and real-time sections' },
      { list_id: createdLists[4].id, title: 'dnd-kit examples', position: 3 },
      { list_id: createdLists[4].id, title: 'Next.js app router docs', position: 4 },
      { list_id: createdLists[4].id, title: 'TypeScript handbook', position: 5 },
    ];

    // Create cards
    const { error: cardsError } = await supabase
      .from('cards')
      .insert(sampleCards.map(card => ({ 
        ...card, 
        user_id: userId, 
        completed: card.completed || false,
        description: card.description || '',
      })));

    if (cardsError) {
      console.error('Error creating sample cards:', cardsError);
    }

    // Fetch the complete data with cards
    const { data: finalData } = await supabase
      .from('lists')
      .select('*, cards(*)')
      .eq('user_id', userId)
      .eq('board', 'work')
      .eq('archived', false)
      .order('position', { ascending: true });

    return finalData;
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

  // Track if this is the initial load
  const hasInitiallyLoaded = useRef(false);

  // Generate mock data for dev bypass mode (no database needed)
  function getDevMockData(): ListType[] {
    const now = new Date().toISOString();
    const userId = 'dev-bypass-user';
    const board = getCurrentBoard();
    return [
      {
        id: 'mock-list-1', title: '📋 To Do', position: 0, width: 240,
        archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
        cards: [
          { id: 'mock-card-1', title: 'Review weekly goals', description: '', position: 0, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-2', title: 'Reply to emails', description: '', position: 1, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-3', title: 'Schedule team meeting', description: '', position: 2, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-4', title: 'Update project timeline', description: '', position: 3, list_id: 'mock-list-1', user_id: userId, completed: false, created_at: now },
        ],
      },
      {
        id: 'mock-list-2', title: '🚀 In Progress', position: 1, width: 300,
        archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
        cards: [
          { id: 'mock-card-5', title: 'Design new dashboard layout', description: 'Focus on mobile responsiveness and accessibility.', position: 0, list_id: 'mock-list-2', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-6', title: 'Write documentation', description: '', position: 1, list_id: 'mock-list-2', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-7', title: 'Fix login bug', description: 'Users on Safari are seeing a timeout error.', position: 2, list_id: 'mock-list-2', user_id: userId, completed: false, created_at: now },
        ],
      },
      {
        id: 'mock-list-3', title: '✅ Completed', position: 2, width: 240,
        archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
        cards: [
          { id: 'mock-card-8', title: 'Set up project repository', description: '', position: 0, list_id: 'mock-list-3', user_id: userId, completed: true, created_at: now },
          { id: 'mock-card-9', title: 'Create database schema', description: '', position: 1, list_id: 'mock-list-3', user_id: userId, completed: true, created_at: now },
          { id: 'mock-card-10', title: 'Implement user authentication', description: '', position: 2, list_id: 'mock-list-3', user_id: userId, completed: true, created_at: now },
          { id: 'mock-card-11', title: 'Add drag and drop', description: '', position: 3, list_id: 'mock-list-3', user_id: userId, completed: false, created_at: now },
        ],
      },
      {
        id: 'mock-list-4', title: '💡 Ideas & Notes', position: 3, width: 380,
        archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
        cards: [
          { id: 'mock-card-12', title: 'Add dark mode support', description: 'Many users prefer dark mode for frequent-use apps.', position: 0, list_id: 'mock-list-4', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-13', title: 'Keyboard shortcuts for power users', description: 'N for new card, L for new list, arrows to navigate.', position: 1, list_id: 'mock-list-4', user_id: userId, completed: false, created_at: now },
        ],
      },
      {
        id: 'mock-list-5', title: '📚 Resources', position: 4, width: 280,
        archived: false, board, shared: false, minimized: false, user_id: userId, created_at: now,
        cards: [
          { id: 'mock-card-14', title: 'React documentation', description: '', position: 0, list_id: 'mock-list-5', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-15', title: 'Tailwind CSS cheatsheet', description: '', position: 1, list_id: 'mock-list-5', user_id: userId, completed: false, created_at: now },
          { id: 'mock-card-16', title: 'Supabase guides', description: 'Check out the auth and real-time sections', position: 2, list_id: 'mock-list-5', user_id: userId, completed: false, created_at: now },
        ],
      },
    ];
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
      if (!user) {
        setLists([]);
        setLoading(false);
        return;
      }

      // In dev bypass mode, use mock data instead of querying Supabase
      if (isDevBypass) {
        if (!hasInitiallyLoaded.current) {
          setLists(getDevMockData());
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

      // Build query - when searching, fetch ALL lists (both boards, archived and non-archived)
      let query = supabase
        .from('lists')
        .select('*, cards(*)')
        .eq('user_id', user.id);
      
      // Only filter by board and archived status when NOT searching
      if (!activeSearch.trim()) {
        // Include lists that match the current board OR are shared
        query = query
          .or(`board.eq.${getCurrentBoard()},shared.eq.true`)
          .eq('archived', isArchiveView);
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
        !activeSearch.trim() &&
        viewMode === 'work' &&
        (data || []).length === 0 &&
        !isCreatingSampleData.current &&
        (await countAllLists(user.id)) === 0;
      if (isStale) return;

      if (isNewUser) {
        isCreatingSampleData.current = true;
        const sampleData = await createSampleData(user.id);
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
  }, [userId, authLoading, viewMode, activeSearch, refreshCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle drag start - track which item is being dragged
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const activeId = active.id as string;
    dragSnapshot.current = lists;
    
    // Check if dragging a list
    if (activeId.startsWith('list-')) {
      const listId = activeId.replace('list-', '');
      const list = lists.find((l) => l.id === listId);
      if (list) {
        setActiveList(list);
        setActiveCard(null);
      }
      return;
    }
    
    // Otherwise, dragging a card
    for (const list of lists) {
      const card = (list.cards || []).find((c) => c.id === activeId);
      if (card) {
        setActiveCard(card);
        setActiveCardListWidth(list.width);
        setActiveList(null);
        break;
      }
    }
  }

  // Handle drag over - move the card into another list while dragging, so it can be previewed there.
  // Reordering within a list is previewed by @dnd-kit itself and applied in handleDragEnd.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId.startsWith('list-')) return;

    setLists((prevLists) => {
      const fromListId = findListIdOfCard(prevLists, activeId);
      const target = findDropTarget(prevLists, overId);
      if (!fromListId || !target || target.listId === fromListId) return prevLists;

      const movingCard = prevLists
        .find((l) => l.id === fromListId)!
        .cards!.find((c) => c.id === activeId)!;

      return prevLists.map((list) => {
        if (list.id === fromListId) {
          return { ...list, cards: (list.cards || []).filter((c) => c.id !== activeId) };
        }
        if (list.id !== target.listId) return list;

        // Insert just above the card we're over, or at the bottom of the list
        let destCards = sortByPosition(list.cards || []);
        const overIndex = destCards.findIndex((c) => c.id === target.overCardId);
        const insertIndex = overIndex === -1 ? destCards.length : overIndex;

        let previewPosition = positionBetween(
          destCards[insertIndex - 1]?.position,
          destCards[insertIndex]?.position
        );
        if (previewPosition === null) {
          // Neighbours share a position; renumber this preview (the real save is worked out on drop)
          destCards = destCards.map((card, index) => ({ ...card, position: index }));
          previewPosition = insertIndex - 0.5;
        }

        return {
          ...list,
          cards: [...destCards, { ...movingCard, list_id: list.id, position: previewPosition }],
        };
      });
    });
  }

  // Handle drag being cancelled (Escape key, browser taking over the touch for scrolling, etc.)
  function handleDragCancel() {
    if (dragSnapshot.current) {
      setLists(dragSnapshot.current);
    }
    dragSnapshot.current = null;
    setActiveCard(null);
    setActiveList(null);
  }

  // Handle drag end event - save to Supabase
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = active.id as string;
    const snapshot = dragSnapshot.current;

    dragSnapshot.current = null;
    setActiveCard(null);
    setActiveList(null);

    if (!snapshot) return;

    if (activeId.startsWith('list-')) {
      handleListDrop(activeId.replace('list-', ''), over ? (over.id as string) : null);
    } else {
      handleCardDrop(activeId, over ? (over.id as string) : null, snapshot);
    }
  }

  // Save a list's new place on the board
  function handleListDrop(activeListId: string, overId: string | null) {
    if (!overId) return;

    const target = findDropTarget(lists, overId);
    if (!target || target.listId === activeListId) return;

    const oldIndex = lists.findIndex((l) => l.id === activeListId);
    const newIndex = lists.findIndex((l) => l.id === target.listId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedLists = arrayMove(lists, oldIndex, newIndex);
    const updates = repositionAfterMove(reorderedLists, activeListId);
    setLists(applyPositionUpdates(reorderedLists, updates));

    if (!isDevBypass) {
      enqueueSave('reordering the lists', () => savePositions('lists', updates));
    }
  }

  // Save a card's new place. `lists` already has the card in its new list (from handleDragOver);
  // `snapshot` is the board from before the drag, i.e. what's in the database.
  function handleCardDrop(activeId: string, overId: string | null, snapshot: ListType[]) {
    const sourceListId = findListIdOfCard(snapshot, activeId);
    const finalListId = findListIdOfCard(lists, activeId);
    if (!sourceListId || !finalListId) {
      setLists(snapshot);
      return;
    }

    // Final order of the card's list, including a reorder within the list on drop
    let finalOrder = sortByPosition(lists.find((l) => l.id === finalListId)!.cards || []).map((c) => c.id);
    const fromIndex = finalOrder.indexOf(activeId);
    const toIndex = overId ? finalOrder.indexOf(overId) : -1;
    if (toIndex !== -1 && toIndex !== fromIndex) {
      finalOrder = arrayMove(finalOrder, fromIndex, toIndex);
    }

    // Nothing changed
    const originalOrder = sortByPosition(snapshot.find((l) => l.id === sourceListId)!.cards || []).map((c) => c.id);
    if (sourceListId === finalListId && finalOrder.join() === originalOrder.join()) {
      setLists(snapshot);
      return;
    }

    // Work out positions from the database values (the snapshot), not the drag preview
    const snapshotCards = new Map(snapshot.flatMap((l) => l.cards || []).map((c) => [c.id, c]));
    const ordered = finalOrder.map((id) => snapshotCards.get(id)).filter((c): c is CardType => !!c);
    const updates = repositionAfterMove(ordered, activeId);
    const movedCard = { ...snapshotCards.get(activeId)!, list_id: finalListId };

    setLists(
      snapshot.map((list) => {
        if (list.id !== sourceListId && list.id !== finalListId) return list;

        let cards = (list.cards || []).filter((c) => c.id !== activeId);
        if (list.id === finalListId) cards = [...cards, movedCard];
        return { ...list, cards: applyPositionUpdates(cards, updates) };
      })
    );

    if (!isDevBypass) {
      enqueueSave('moving the card', () =>
        savePositions('cards', updates, { [activeId]: { list_id: finalListId } })
      );
    }
  }

  // Create a new list
  async function handleCreateList() {
    // Don't create if title is empty or not logged in or in archive view
    if (!newListTitle.trim() || !user || isArchiveView) {
      return;
    }

    // Calculate position for new list (at the end)
    const newPosition = nextPosition(lists);

    // In dev bypass mode, create with a mock ID (no database)
    if (isDevBypass) {
      const mockList: ListType = {
        id: `mock-list-${Date.now()}`,
        title: newListTitle.trim(),
        position: newPosition,
        width: 300,
        archived: false,
        board: getCurrentBoard(),
        shared: false,
        minimized: false,
        user_id: user.id,
        created_at: new Date().toISOString(),
        cards: [],
      };
      setLists((prevLists) => [...prevLists, mockList]);
      setNewListTitle('');
      setIsAddingList(false);
      return;
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('lists')
      .insert({
        title: newListTitle.trim(),
        position: newPosition,
        width: 300,
        archived: false,
        board: getCurrentBoard(),
        shared: false,
        minimized: false,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating list:', error);
      setSaveError("Couldn't add the list.");
      return;
    }

    // Add new list to state (updates UI immediately)
    if (data) {
      setLists((prevLists) => [...prevLists, { ...data, cards: [] }]);
    }

    // Reset the form
    setNewListTitle('');
    setIsAddingList(false);
  }

  // Handle pressing Enter key for list creation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleCreateList();
    }
    if (e.key === 'Escape') {
      setNewListTitle('');
      setIsAddingList(false);
    }
  }

  // Create a new card in a list
  async function handleCreateCard(listId: string, title: string) {
    // Find the list
    const list = lists.find((l) => l.id === listId);
    if (!list || !user) return;

    // Calculate position for new card (at the end)
    const newPosition = nextPosition(list.cards || []);

    // In dev bypass mode, create with a mock ID (no database)
    if (isDevBypass) {
      const mockCard: CardType = {
        id: `mock-card-${Date.now()}`,
        title: title.trim(),
        description: '',
        position: newPosition,
        list_id: listId,
        user_id: user.id,
        completed: false,
        created_at: new Date().toISOString(),
      };
      setLists((prevLists) =>
        prevLists.map((l) =>
          l.id === listId
            ? { ...l, cards: [...(l.cards || []), mockCard] }
            : l
        )
      );
      return;
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('cards')
      .insert({
        title: title.trim(),
        list_id: listId,
        position: newPosition,
        completed: false,
        description: '',
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating card:', error);
      setSaveError("Couldn't add the card.");
      return;
    }

    // Update state to show new card immediately
    if (data) {
      setLists((prevLists) =>
        prevLists.map((l) =>
          l.id === listId
            ? { ...l, cards: [...(l.cards || []), data] }
            : l
        )
      );
    }
  }

  // Save changed fields of a card or list (skipped in dev bypass mode)
  function saveChanges(table: 'cards' | 'lists', id: string, changes: Partial<CardType> | Partial<ListType>, what: string) {
    if (isDevBypass) return Promise.resolve(true);
    return enqueueSave(what, () => supabase.from(table).update(changes).eq('id', id));
  }

  // Change a card: update the screen right away, then save
  function updateCard(cardId: string, changes: Partial<CardType>, what: string) {
    setLists((prevLists) =>
      prevLists.map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) => (card.id === cardId ? { ...card, ...changes } : card)),
      }))
    );
    return saveChanges('cards', cardId, changes, what);
  }

  // Change a list that stays on this board
  function updateList(listId: string, changes: Partial<ListType>, what: string) {
    setLists((prevLists) => prevLists.map((l) => (l.id === listId ? { ...l, ...changes } : l)));
    return saveChanges('lists', listId, changes, what);
  }

  // Change a list in a way that takes it off this board (archive, unarchive, move to other board)
  function removeListFromView(listId: string, changes: Partial<ListType>, what: string) {
    setLists((prevLists) => prevLists.filter((l) => l.id !== listId));
    return saveChanges('lists', listId, changes, what);
  }

  // Delete a card
  function handleDeleteCard(cardId: string, listId: string) {
    setLists((prevLists) =>
      prevLists.map((l) =>
        l.id === listId ? { ...l, cards: (l.cards || []).filter((c) => c.id !== cardId) } : l
      )
    );

    if (!isDevBypass) {
      enqueueSave('deleting the card', () => supabase.from('cards').delete().eq('id', cardId));
    }
  }

  function handleArchiveList(listId: string) {
    removeListFromView(listId, { archived: true }, 'archiving the list');
  }

  function handleUnarchiveList(listId: string) {
    removeListFromView(listId, { archived: false }, 'unarchiving the list');
  }

  function handleMoveList(listId: string, targetBoard: BoardType) {
    const list = lists.find((l) => l.id === listId);
    if (!list || list.board === targetBoard) return;
    removeListFromView(listId, { board: targetBoard }, 'moving the list to another board');
  }

  function handleToggleShared(listId: string) {
    const list = lists.find((l) => l.id === listId);
    if (list) updateList(listId, { shared: !list.shared }, 'sharing the list');
  }

  function handleToggleMinimized(listId: string) {
    const list = lists.find((l) => l.id === listId);
    if (list) updateList(listId, { minimized: !list.minimized }, 'minimizing the list');
  }

  function handleRenameList(listId: string, newTitle: string) {
    updateList(listId, { title: newTitle }, 'renaming the list');
  }

  // Handle list resize (UI update only - called on every mouse move)
  function handleResizeList(listId: string, newWidth: number) {
    setLists((prevLists) => prevLists.map((l) => (l.id === listId ? { ...l, width: newWidth } : l)));
  }

  // Handle list resize end (save to database - called once on mouse up)
  function handleResizeListEnd(listId: string, newWidth: number) {
    // The width column is an INTEGER, so round to avoid save failures
    saveChanges('lists', listId, { width: Math.round(newWidth) }, 'resizing the list');
  }

  // Handle opening card details modal
  function handleCardClick(cardId: string) {
    for (const list of lists) {
      const card = (list.cards || []).find((c) => c.id === cardId);
      if (card) {
        setSelectedCard(card);
        break;
      }
    }
  }

  // Handle saving card details (resolves to whether the save worked)
  function handleSaveCard(cardId: string, title: string, description: string) {
    return updateCard(cardId, { title, description }, 'saving the card details');
  }

  function handleToggleComplete(cardId: string) {
    const card = lists.flatMap((l) => l.cards || []).find((c) => c.id === cardId);
    if (card) updateCard(cardId, { completed: !card.completed }, 'ticking off the card');
  }

  // Drag-to-scroll handlers for the board
  function handleBoardMouseDown(e: React.MouseEvent) {
    // Only start drag-scroll if clicking on empty board space
    const target = e.target as HTMLElement;
    const isOnList = target.closest('.glass');
    const isOnButton = target.closest('button');
    const isOnInput = target.closest('input') || target.closest('textarea');
    
    if (!isOnList && !isOnButton && !isOnInput && boardRef.current) {
      setIsDraggingBoard(true);
      dragStartX.current = e.clientX;
      scrollStartX.current = boardRef.current.scrollLeft;
      document.body.style.userSelect = 'none';
    }
  }

  function handleBoardMouseMove(e: React.MouseEvent) {
    if (!isDraggingBoard || !boardRef.current) return;
    
    const deltaX = e.clientX - dragStartX.current;
    boardRef.current.scrollLeft = scrollStartX.current - deltaX;
  }

  function handleBoardMouseUp() {
    if (isDraggingBoard) {
      setIsDraggingBoard(false);
      document.body.style.userSelect = '';
    }
  }

  function handleBoardMouseLeave() {
    if (isDraggingBoard) {
      setIsDraggingBoard(false);
      document.body.style.userSelect = '';
    }
  }

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 text-sm">Loading your board...</p>
        </div>
      </div>
    );
  }

  // Show sign-in screen if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-100 mb-3">My Trello Clone</h1>
            <p className="text-slate-400">Organize your tasks with a beautiful kanban board</p>
          </div>
          
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 bg-white text-slate-800 px-6 py-3 rounded-lg font-medium hover:bg-slate-100 transition-colors shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
          
          <p className="mt-8 text-sm text-slate-500">
            Your data is private and only you can see your boards
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  // Generate list IDs for SortableContext
  const listIds = lists.map((list) => `list-${list.id}`);

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-gradient-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="px-4 py-2.5 overflow-x-auto hide-scrollbar">
        <div className="flex items-center justify-between gap-4 min-w-max">
          <div className="flex items-center gap-4 flex-shrink-0">
            <h1 className="text-lg font-semibold text-slate-100 whitespace-nowrap leading-tight">My Trello Clone</h1>
            
            {/* View Mode Tabs */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => setViewMode('work')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'work'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Work
              </button>
              <button
                onClick={() => setViewMode('personal')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'personal'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Personal
              </button>
              <span className="text-slate-600 px-1">|</span>
              <button
                onClick={() => setViewMode('work-archive')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'work-archive'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Work Archive
              </button>
              <button
                onClick={() => setViewMode('personal-archive')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'personal-archive'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Pers Archive
              </button>
            </div>
          </div>
          
          {/* Search and User info */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Search Input */}
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 sm:w-52 pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
            
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-slate-600"
              />
            )}
            <span className="text-sm text-slate-300 hidden sm:inline">
              {user.user_metadata?.full_name || user.email}
            </span>
            <button
              onClick={signOut}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
        </div>
      </header>

      {/* Board */}
      <main 
        ref={boardRef}
        className={`p-3 pb-8 overflow-x-auto overflow-y-hidden hide-scrollbar relative mobile-scroll flex-1 ${isDraggingBoard ? 'cursor-grabbing select-none' : ''}`}
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={handleBoardMouseUp}
        onMouseLeave={handleBoardMouseLeave}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 items-start pr-8 h-full">
              {/* Display all lists */}
              {lists.map((list) => (
                <SortableList
                  key={list.id}
                  list={list}
                  onCreateCard={handleCreateCard}
                  onDeleteCard={handleDeleteCard}
                  onArchiveList={
                    // When searching, use list's actual archived status; otherwise use isArchiveView
                    activeSearch.trim()
                      ? (list.archived ? handleUnarchiveList : handleArchiveList)
                      : (isArchiveView ? handleUnarchiveList : handleArchiveList)
                  }
                  onMoveList={handleMoveList}
                  onResize={handleResizeList}
                  onResizeEnd={handleResizeListEnd}
                  onRenameList={handleRenameList}
                  onToggleShared={handleToggleShared}
                  onToggleMinimized={handleToggleMinimized}
                  onCardClick={handleCardClick}
                  onToggleComplete={handleToggleComplete}
                  isArchiveView={activeSearch.trim() ? list.archived : isArchiveView}
                  searchQuery={activeSearch}
                />
              ))}

              {/* Add List Section - only show when not in archive view */}
              {!isArchiveView && (
                isAddingList ? (
                  // Show input form when adding a list
                  <div className="flex-shrink-0 w-64 glass rounded-md p-2">
                    <input
                      type="text"
                      placeholder="Enter list title..."
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 focus:outline-none focus:border-blue-500 text-slate-700 text-base sm:text-sm placeholder-slate-400"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleCreateList}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-500 transition-colors"
                      >
                        Add list
                      </button>
                      <button
                        onClick={() => {
                          setNewListTitle('');
                          setIsAddingList(false);
                        }}
                        className="text-slate-400 hover:text-slate-600 px-2 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  // Show button when not adding
                  <button
                    onClick={() => setIsAddingList(true)}
                    className="flex-shrink-0 w-64 bg-white/30 hover:bg-white/50 border border-white/40 rounded-md px-3 py-2 text-slate-200 hover:text-white transition-all text-left text-sm"
                  >
                    + Add a list
                  </button>
                )
              )}
            </div>
          </SortableContext>

          {/* Drag Overlay - shows the item being dragged */}
          <DragOverlay>
            {activeCard ? (
              <div 
                className="bg-white rounded-md shadow-xl p-2 rotate-2"
                style={{ width: `${activeCardListWidth - 12}px` }}
              >
                <div className="flex items-start gap-2">
                  {/* Checkbox visual */}
                  <div className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                    activeCard.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-300'
                  }`}>
                    {activeCard.completed && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <p className={`text-xs flex-1 leading-relaxed ${
                    activeCard.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                  }`}>{activeCard.title}</p>
                </div>
              </div>
            ) : null}
            {activeList ? (
              activeList.minimized ? (
                <div className="glass rounded-md shadow-xl py-2.5 px-1 rotate-1 flex flex-col items-center" style={{ width: '40px' }}>
                  <span
                    className="font-medium text-slate-500 text-[11px] whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                  >
                    {activeList.title}
                  </span>
                </div>
              ) : (
                <div className="glass rounded-md shadow-xl p-2.5 rotate-1" style={{ width: `${activeList.width}px` }}>
                  <p className="font-medium text-slate-700 text-sm">{activeList.title}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {(activeList.cards || []).length} card{(activeList.cards || []).length !== 1 ? 's' : ''}
                  </p>
                </div>
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Card Details Modal */}
      {selectedCard && (
        <CardDetailsModal
          key={selectedCard.id}
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSave={handleSaveCard}
          onDelete={(cardId) => {
            const listId = findListIdOfCard(lists, cardId);
            if (listId) handleDeleteCard(cardId, listId);
          }}
        />
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white text-sm px-4 py-2 rounded-md shadow-lg">
          <span>{saveError}</span>
          <button
            onClick={() => {
              setSaveError(null);
              setRefreshCount((count) => count + 1);
            }}
            className="font-medium underline hover:no-underline"
          >
            Reload board
          </button>
          <button
            onClick={() => setSaveError(null)}
            className="text-white/80 hover:text-white"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
