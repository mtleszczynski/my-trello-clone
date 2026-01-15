'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { supabase } from './lib/supabase';
import { List as ListType, Card as CardType } from './types';
import List from './components/List';

export default function Home() {
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for adding a new list
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  // State for tracking the currently dragged card
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

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

  // Handle drag start - track which card is being dragged
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    
    // Find the card being dragged
    for (const list of lists) {
      const card = (list.cards || []).find((c) => c.id === active.id);
      if (card) {
        setActiveCard(card);
        break;
      }
    }
  }

  // Handle drag end event
  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null); // Clear the active card
    
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Find which list contains the dragged card
    let sourceList: ListType | undefined;

    for (const list of lists) {
      const cardIndex = (list.cards || []).findIndex((c) => c.id === active.id);
      if (cardIndex !== -1) {
        sourceList = list;
        break;
      }
    }

    if (!sourceList) return;

    // For now, only handle reordering within the same list
    const overCardIndex = (sourceList.cards || []).findIndex((c) => c.id === over.id);
    
    if (overCardIndex === -1) return; // Card dropped on something that's not a card in this list

    // Reorder cards in the list
    const sortedCards = [...(sourceList.cards || [])].sort((a, b) => a.position - b.position);
    const oldIndex = sortedCards.findIndex((c) => c.id === active.id);
    const newIndex = sortedCards.findIndex((c) => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedCards = arrayMove(sortedCards, oldIndex, newIndex);

    // Update positions
    const updatedCards = reorderedCards.map((card, index) => ({
      ...card,
      position: index,
    }));

    // Update state immediately (optimistic update)
    setLists(
      lists.map((l) =>
        l.id === sourceList!.id ? { ...l, cards: updatedCards } : l
      )
    );

    // Save new positions to Supabase
    for (const card of updatedCards) {
      const { error } = await supabase
        .from('cards')
        .update({ position: card.position })
        .eq('id', card.id);

      if (error) {
        console.error('Error updating card position:', error);
      }
    }
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

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p className="text-gray-600">Loading your board...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">My Trello Clone</h1>
      </header>

      {/* Board */}
      <main className="p-4 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 items-start">
            {/* Display all lists */}
            {lists.map((list) => (
              <List
                key={list.id}
                list={list}
                onCreateCard={handleCreateCard}
                onDeleteCard={handleDeleteCard}
                onDeleteList={handleDeleteList}
              />
            ))}

            {/* Add List Section */}
            {isAddingList ? (
              // Show input form when adding a list
              <div className="flex-shrink-0 w-72 bg-gray-100 rounded-lg p-2">
                <input
                  type="text"
                  placeholder="Enter list title..."
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCreateList}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
                  >
                    Add list
                  </button>
                  <button
                    onClick={() => {
                      setNewListTitle('');
                      setIsAddingList(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 px-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              // Show button when not adding
              <button
                onClick={() => setIsAddingList(true)}
                className="flex-shrink-0 w-72 bg-white/50 hover:bg-white/80 rounded-lg p-3 text-gray-600 hover:text-gray-800 transition-colors text-left"
              >
                + Add a list
              </button>
            )}
          </div>

          {/* Drag Overlay - shows the card being dragged */}
          <DragOverlay>
            {activeCard ? (
              <div className="bg-white rounded-lg shadow-lg p-3 w-64 opacity-90">
                <p className="text-gray-900 text-sm">{activeCard.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
