'use client';

import { List as ListType } from '../types';

interface ListProps {
  list: ListType;
}

export default function List({ list }: ListProps) {
  return (
    <div
      className="flex-shrink-0 flex flex-col bg-gray-100 rounded-lg"
      style={{ width: `${list.width}px` }}
    >
      {/* List Header */}
      <div className="p-3 font-semibold text-gray-900">
        {list.title}
      </div>

      {/* Cards Container */}
      <div className="flex-1 overflow-y-auto p-2 min-h-[100px]">
        {/* Cards will go here later */}
        <p className="text-gray-400 text-sm text-center py-4">
          No cards yet
        </p>
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
