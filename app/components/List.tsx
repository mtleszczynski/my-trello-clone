'use client';

import { useState } from 'react';
import { List as ListType } from '../types';
import Card from './Card';

interface ListProps {
  list: ListType;
  onCreateCard: (listId: string, title: string) => void;
}

export default function List({ list, onCreateCard }: ListProps) {
  // State for adding a new card
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  // Sort cards by position
  const sortedCards = [...(list.cards || [])].sort((a, b) => a.position - b.position);

  // Handle creating a new card
  function handleCreateCard() {
    if (!newCardTitle.trim()) return;
    
    onCreateCard(list.id, newCardTitle.trim());
    setNewCardTitle('');
    setIsAddingCard(false);
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleCreateCard();
    }
    if (e.key === 'Escape') {
      setNewCardTitle('');
      setIsAddingCard(false);
    }
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col bg-gray-100 rounded-lg max-h-[calc(100vh-120px)]"
      style={{ width: `${list.width}px` }}
    >
      {/* List Header */}
      <div className="p-3 font-semibold text-gray-900">
        {list.title}
      </div>

      {/* Cards Container */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {sortedCards.length > 0 ? (
          sortedCards.map((card) => (
            <Card key={card.id} card={card} />
          ))
        ) : (
          !isAddingCard && (
            <p className="text-gray-400 text-sm text-center py-4">
              No cards yet
            </p>
          )
        )}
      </div>

      {/* Add Card Section */}
      <div className="p-2">
        {isAddingCard ? (
          <div>
            <textarea
              placeholder="Enter a title for this card..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
              className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:border-blue-500 resize-none text-sm"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreateCard}
                className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors text-sm"
              >
                Add card
              </button>
              <button
                onClick={() => {
                  setNewCardTitle('');
                  setIsAddingCard(false);
                }}
                className="text-gray-500 hover:text-gray-700 px-2"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            className="w-full text-left text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-200 transition-colors"
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
}
