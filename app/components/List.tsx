'use client';

import { List as ListType } from '../types';
import Card from './Card';

interface ListProps {
  list: ListType;
}

export default function List({ list }: ListProps) {
  // Sort cards by position
  const sortedCards = [...(list.cards || [])].sort((a, b) => a.position - b.position);

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
          <p className="text-gray-400 text-sm text-center py-4">
            No cards yet
          </p>
        )}
      </div>

      {/* Add Card Button (placeholder for now) */}
      <div className="p-2">
        <button className="w-full text-left text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-200 transition-colors">
          + Add a card
        </button>
      </div>
    </div>
  );
}
