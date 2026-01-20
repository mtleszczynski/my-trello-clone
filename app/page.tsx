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
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from './lib/supabase';
import { List as ListType, Card as CardType } from './types';
import SortableList from './components/SortableList';
import CardDetailsModal from './components/CardDetailsModal';
import { useAuth } from './components/AuthProvider';

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for view mode (main board vs archive)
  const [viewMode, setViewMode] = useState<'main' | 'archive'>('main');
  
  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for adding a new list
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  // State for tracking the currently dragged item
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [activeCardListWidth, setActiveCardListWidth] = useState<number>(300);
  const [activeList, setActiveList] = useState<ListType | null>(null);
  
  // State for card details modal
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  
  // Track the original state before drag started (for saving to Supabase)
  const dragStartState = useRef<{ cardId: string; sourceListId: string } | null>(null);
  
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
      .insert(sampleLists.map(list => ({ ...list, user_id: userId, archived: false })))
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
      .eq('archived', false)
      .order('position', { ascending: true });

    return finalData;
  }

  // Track if this is the initial load
  const hasInitiallyLoaded = useRef(false);

  // Fetch lists from Supabase when the page loads (only when user is logged in)
  useEffect(() => {
    async function fetchLists() {
      if (!user) {
        setLists([]);
        setLoading(false);
        return;
      }

      // Only show loading screen on initial load, not when searching
      if (!hasInitiallyLoaded.current) {
        setLoading(true);
      }
      setError(null);

      // Build query - when searching, fetch ALL lists (both archived and non-archived)
      let query = supabase
        .from('lists')
        .select('*, cards(*)')
        .eq('user_id', user.id);
      
      // Only filter by archived status when NOT searching
      if (!searchQuery.trim()) {
        query = query.eq('archived', viewMode === 'archive');
      }
      
      const { data, error } = await query.order('position', { ascending: true });

      if (error) {
        console.error('Error fetching lists:', error);
        setError('Failed to load lists. Please try again.');
        setLoading(false);
        return;
      }

      // If user has no lists on main board, create sample data (only once)
      if (!searchQuery.trim() && viewMode === 'main' && data && data.length === 0 && !isCreatingSampleData.current) {
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
  }, [user, authLoading, viewMode, searchQuery]);

  // Handle drag start - track which item is being dragged
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const activeId = active.id as string;
    
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
        dragStartState.current = { cardId: card.id, sourceListId: list.id };
        break;
      }
    }
  }

  // Handle drag over - move card between lists in real-time
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // If dragging a list, don't do anything in dragOver
    if (activeId.startsWith('list-')) return;
    
    // Card dragging logic
    if (!activeCard) return;

    // Find current list of the dragged card
    let activeListContainer: ListType | undefined;
    for (const list of lists) {
      if ((list.cards || []).find((c) => c.id === activeId)) {
        activeListContainer = list;
        break;
      }
    }

    if (!activeListContainer) return;

    // Determine the target list
    let overList: ListType | undefined;
    let overCardId: string | null = null;

    // Check if over.id is a list ID (for dropping on empty lists or list container)
    overList = lists.find((l) => l.id === overId || `list-${l.id}` === overId);

    if (!overList) {
      // Check if over.id is a card ID
      for (const list of lists) {
        const card = (list.cards || []).find((c) => c.id === overId);
        if (card) {
          overList = list;
          overCardId = card.id;
          break;
        }
      }
    }

    if (!overList) return;

    // If same list, let SortableContext handle it
    if (activeListContainer.id === overList.id) {
      // Reorder within same list
      if (overCardId && activeId !== overCardId) {
        setLists((prevLists) => {
          return prevLists.map((list) => {
            if (list.id !== activeListContainer!.id) return list;

            const cards = [...(list.cards || [])].sort((a, b) => a.position - b.position);
            const oldIndex = cards.findIndex((c) => c.id === activeId);
            const newIndex = cards.findIndex((c) => c.id === overCardId);

            if (oldIndex === -1 || newIndex === -1) return list;

            const reorderedCards = arrayMove(cards, oldIndex, newIndex).map((card, index) => ({
              ...card,
              position: index,
            }));

            return { ...list, cards: reorderedCards };
          });
        });
      }
      return;
    }

    // Moving to a different list
    setLists((prevLists) => {
      // Remove card from source list
      const newLists = prevLists.map((list) => {
        if (list.id === activeListContainer!.id) {
          const filteredCards = (list.cards || [])
            .filter((c) => c.id !== activeId)
            .sort((a, b) => a.position - b.position)
            .map((card, index) => ({ ...card, position: index }));
          return { ...list, cards: filteredCards };
        }
        return list;
      });

      // Add card to destination list
      return newLists.map((list) => {
        if (list.id === overList!.id) {
          const destCards = [...(list.cards || [])].sort((a, b) => a.position - b.position);
          
          // Find insert position
          let insertIndex = destCards.length;
          if (overCardId) {
            const overIndex = destCards.findIndex((c) => c.id === overCardId);
            if (overIndex !== -1) {
              insertIndex = overIndex;
            }
          }

          // Create the moved card with updated list_id
          const movedCard = { ...activeCard!, list_id: list.id };
          
          // Insert at position
          destCards.splice(insertIndex, 0, movedCard);
          
          // Update positions
          const updatedCards = destCards.map((card, index) => ({
            ...card,
            position: index,
          }));

          return { ...list, cards: updatedCards };
        }
        return list;
      });
    });
  }

  // Handle drag end event - save to Supabase
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    const activeId = active.id as string;
    
    // Handle list reordering
    if (activeId.startsWith('list-') && over) {
      const overId = over.id as string;
      
      // Get the actual list IDs
      const activeListId = activeId.replace('list-', '');
      
      // overId could be 'list-{id}' or just '{id}' (the droppable area)
      let overListId = overId.startsWith('list-') ? overId.replace('list-', '') : overId;
      
      // Check if overListId is actually a list (not a card)
      const isOverAList = lists.some((l) => l.id === overListId);
      
      if (!isOverAList) {
        // Maybe we're over a card - find which list contains it
        for (const list of lists) {
          const card = (list.cards || []).find((c) => c.id === overId);
          if (card) {
            overListId = list.id;
            break;
          }
        }
      }
      
      if (activeListId !== overListId) {
        const oldIndex = lists.findIndex((l) => l.id === activeListId);
        const newIndex = lists.findIndex((l) => l.id === overListId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedLists = arrayMove(lists, oldIndex, newIndex).map((list, index) => ({
            ...list,
            position: index,
          }));
          
          setLists(reorderedLists);
          
          // Save to Supabase
          for (const list of reorderedLists) {
            await supabase
              .from('lists')
              .update({ position: list.position })
              .eq('id', list.id);
          }
        }
      }
      
      setActiveList(null);
      setActiveCard(null);
      return;
    }
    
    // Handle card dragging
    setActiveCard(null);
    setActiveList(null);
    
    if (!dragStartState.current) return;

    // Find the card's current list (after all the drag over updates)
    let currentList: ListType | undefined;
    let currentCard: CardType | undefined;

    for (const list of lists) {
      const card = (list.cards || []).find((c) => c.id === activeId);
      if (card) {
        currentList = list;
        currentCard = card;
        break;
      }
    }

    if (!currentList || !currentCard) {
      dragStartState.current = null;
      return;
    }

    // Save to Supabase
    const { sourceListId } = dragStartState.current;
    
    // Update the card's list_id and position
    await supabase
      .from('cards')
      .update({ 
        list_id: currentList.id, 
        position: currentCard.position 
      })
      .eq('id', activeId);

    // Update positions in current list
    const currentListCards = (currentList.cards || []).filter((c) => c.id !== activeId);
    for (const card of currentListCards) {
      await supabase
        .from('cards')
        .update({ position: card.position })
        .eq('id', card.id);
    }

    // If moved to different list, update source list positions too
    if (sourceListId !== currentList.id) {
      const sourceList = lists.find((l) => l.id === sourceListId);
      if (sourceList) {
        for (const card of sourceList.cards || []) {
          await supabase
            .from('cards')
            .update({ position: card.position })
            .eq('id', card.id);
        }
      }
    }

    dragStartState.current = null;
  }

  // Create a new list
  async function handleCreateList() {
    // Don't create if title is empty or not logged in
    if (!newListTitle.trim() || !user) {
      return;
    }

    // Calculate position for new list (at the end)
    const newPosition = lists.length;

    // Save to Supabase
    const { data, error } = await supabase
      .from('lists')
      .insert({
        title: newListTitle.trim(),
        position: newPosition,
        width: 300,
        archived: false,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating list:', error);
      return;
    }

    // Add new list to state (updates UI immediately)
    if (data) {
      setLists([...lists, { ...data, cards: [] }]);
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
    const newPosition = (list.cards || []).length;

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
      return;
    }

    // Update state to show new card immediately
    if (data) {
      setLists(
        lists.map((l) =>
          l.id === listId
            ? { ...l, cards: [...(l.cards || []), data] }
            : l
        )
      );
    }
  }

  // Delete a card
  async function handleDeleteCard(cardId: string, listId: string) {
    // Update UI immediately (optimistic update)
    setLists(
      lists.map((l) =>
        l.id === listId
          ? { ...l, cards: (l.cards || []).filter((c) => c.id !== cardId) }
          : l
      )
    );

    // Delete from Supabase
    const { error } = await supabase.from('cards').delete().eq('id', cardId);

    if (error) {
      console.error('Error deleting card:', error);
      // Could reload data here to restore the card if delete failed
    }
  }

  // Archive a list (move to archive)
  async function handleArchiveList(listId: string) {
    // Update UI immediately (optimistic update)
    setLists(lists.filter((l) => l.id !== listId));

    // Update in Supabase to set archived = true
    const { error } = await supabase
      .from('lists')
      .update({ archived: true })
      .eq('id', listId);

    if (error) {
      console.error('Error archiving list:', error);
      // Could reload data here to restore the list if archive failed
    }
  }

  // Unarchive a list (move back to main board)
  async function handleUnarchiveList(listId: string) {
    // Update UI immediately (optimistic update)
    setLists(lists.filter((l) => l.id !== listId));

    // Update in Supabase to set archived = false
    const { error } = await supabase
      .from('lists')
      .update({ archived: false })
      .eq('id', listId);

    if (error) {
      console.error('Error unarchiving list:', error);
      // Could reload data here to restore the list if unarchive failed
    }
  }

  // Handle list resize
  async function handleResizeList(listId: string, newWidth: number) {
    // Update UI immediately (optimistic update)
    setLists(
      lists.map((l) => (l.id === listId ? { ...l, width: newWidth } : l))
    );

    // Save to Supabase
    const { error } = await supabase
      .from('lists')
      .update({ width: newWidth })
      .eq('id', listId);

    if (error) {
      console.error('Error updating list width:', error);
      // Could reload data here to restore the width if update failed
    }
  }

  // Handle opening card details modal
  function handleCardClick(cardId: string) {
    // Find the card in the lists
    for (const list of lists) {
      const card = (list.cards || []).find((c) => c.id === cardId);
      if (card) {
        setSelectedCard(card);
        break;
      }
    }
  }

  // Handle saving card details
  async function handleSaveCard(cardId: string, title: string, description: string) {
    // Update UI immediately (optimistic update)
    setLists(
      lists.map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) =>
          card.id === cardId
            ? { ...card, title, description }
            : card
        ),
      }))
    );

    // Save to Supabase
    const { error } = await supabase
      .from('cards')
      .update({ title, description })
      .eq('id', cardId);

    if (error) {
      console.error('Error updating card:', error);
      // Could reload data here to restore the card if update failed
    }
  }

  // Handle toggling card completion
  async function handleToggleComplete(cardId: string) {
    // Find the card and toggle its completed state
    let newCompletedState = false;
    
    // Update UI immediately (optimistic update)
    setLists(
      lists.map((list) => ({
        ...list,
        cards: (list.cards || []).map((card) => {
          if (card.id === cardId) {
            newCompletedState = !card.completed;
            return { ...card, completed: newCompletedState };
          }
          return card;
        }),
      }))
    );

    // Save to Supabase
    const { error } = await supabase
      .from('cards')
      .update({ completed: newCompletedState })
      .eq('id', cardId);

    if (error) {
      console.error('Error updating card completion:', error);
      // Could reload data here to restore the card if update failed
    }
  }

  // Handle renaming a list
  async function handleRenameList(listId: string, newTitle: string) {
    // Update UI immediately (optimistic update)
    setLists(
      lists.map((list) =>
        list.id === listId ? { ...list, title: newTitle } : list
      )
    );

    // Save to Supabase
    const { error } = await supabase
      .from('lists')
      .update({ title: newTitle })
      .eq('id', listId);

    if (error) {
      console.error('Error renaming list:', error);
      // Could reload data here to restore the title if update failed
    }
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
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-100">My Trello Clone</h1>
            
            {/* View Mode Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('main')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'main'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setViewMode('archive')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'archive'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Archive
              </button>
            </div>
          </div>
          
          {/* Search and User info */}
          <div className="flex items-center gap-3">
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
      </header>

      {/* Board */}
      <main 
        ref={boardRef}
        className={`p-3 pb-8 overflow-x-auto hide-scrollbar relative mobile-scroll min-h-[calc(100vh-56px)] ${isDraggingBoard ? 'cursor-grabbing select-none' : ''}`}
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={handleBoardMouseUp}
        onMouseLeave={handleBoardMouseLeave}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 items-start pr-8">
              {/* Display all lists */}
              {lists.map((list) => (
                <SortableList
                  key={list.id}
                  list={list}
                  onCreateCard={handleCreateCard}
                  onDeleteCard={handleDeleteCard}
                  onArchiveList={
                    // When searching, use list's actual archived status; otherwise use viewMode
                    searchQuery.trim()
                      ? (list.archived ? handleUnarchiveList : handleArchiveList)
                      : (viewMode === 'main' ? handleArchiveList : handleUnarchiveList)
                  }
                  onResize={handleResizeList}
                  onRenameList={handleRenameList}
                  onCardClick={handleCardClick}
                  onToggleComplete={handleToggleComplete}
                  isArchiveView={searchQuery.trim() ? list.archived : viewMode === 'archive'}
                  searchQuery={searchQuery}
                />
              ))}

              {/* Add List Section */}
              {isAddingList ? (
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
              <div className="glass rounded-md shadow-xl p-2.5 rotate-1" style={{ width: `${activeList.width}px` }}>
                <p className="font-medium text-slate-700 text-sm">{activeList.title}</p>
                <p className="text-slate-500 text-xs mt-1">
                  {(activeList.cards || []).length} card{(activeList.cards || []).length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Card Details Modal */}
      <CardDetailsModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onSave={handleSaveCard}
        onDelete={(cardId) => {
          // Find the list containing the card
          for (const list of lists) {
            if ((list.cards || []).find((c) => c.id === cardId)) {
              handleDeleteCard(cardId, list.id);
              break;
            }
          }
        }}
      />
    </div>
  );
}
