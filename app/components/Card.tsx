'use client';

import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onDelete: () => void;
}

export default function Card({ card, onDelete }: CardProps) {
  return (
    <div className="group bg-white rounded-lg shadow-sm p-3 cursor-pointer hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-900 text-sm flex-1">{card.title}</p>
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering card click
            onDelete();
          }}
          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete card"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
