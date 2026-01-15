'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from './lib/supabase';
import { List as ListType, Card as CardType } from './types';
import SortableList from './components/SortableList';
import CardDetailsModal from './components/CardDetailsModal';

export default function Home() {
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for adding a new list
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  // State for tracking the currently dragged item
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [activeList, setActiveList] = useState<ListType | null>(null);
  
  // State for card details modal
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  
  // Track the original state before drag started (for saving to Supabase)
  const dragStartState = useRef<{ cardId: string; sourceListId: string } | null>(null);

  // Drag-to-scroll for the board
  const boardRef = useRef<HTMLElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  // Set up drag sensors (pointer sensor with a small activation distance)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Fetch lists from Supabase when the page loads
  useEffect(() => {
    async function fetchLists() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('lists')
        .select('*, cards(*)')
        .eq('archived', false)
        .order('position', { ascending: true });

      if (error) {
        console.error('Error fetching lists:', error);
        setError('Failed to load lists. Please try again.');
        setLoading(false);
        return;
      }

      setLists(data || []);
      setLoading(false);
    }

    fetchLists();
  }, []);

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
    // Don't create if title is empty
    if (!newListTitle.trim()) {
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
    if (!list) return;

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

  // Delete a list (and all its cards)
  async function handleDeleteList(listId: string) {
    // Update UI immediately (optimistic update)
    setLists(lists.filter((l) => l.id !== listId));

    // Delete from Supabase (cards are deleted automatically due to CASCADE)
    const { error } = await supabase.from('lists').delete().eq('id', listId);

    if (error) {
      console.error('Error deleting list:', error);
      // Could reload data here to restore the list if delete failed
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
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 text-sm">Loading your board...</p>
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
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-100">My Trello Clone</h1>
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
                  onDeleteList={handleDeleteList}
                  onResize={handleResizeList}
                  onCardClick={handleCardClick}
                  onToggleComplete={handleToggleComplete}
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
                    className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 focus:outline-none focus:border-blue-500 text-slate-700 text-sm placeholder-slate-400"
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
              <div className="bg-white rounded-md shadow-xl p-2.5 w-56 rotate-2">
                <p className="text-slate-700 text-sm">{activeCard.title}</p>
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
      />
    </div>
  );
}
