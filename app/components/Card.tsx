'use client';

import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onDelete: () => void;
  onClick?: () => void;
  onToggleComplete?: () => void;
}

export default function Card({ card, onDelete, onClick, onToggleComplete }: CardProps) {
  const hasDescription = card.description && card.description.trim().length > 0;

  return (
    <div 
      className={`group bg-white rounded-lg shadow-sm p-3 cursor-pointer hover:bg-gray-50 transition-colors relative ${
        card.completed ? 'opacity-60' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering card click
            onToggleComplete?.();
          }}
          className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            card.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-500'
          }`}
          title={card.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {card.completed && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <p className={`text-sm flex-1 pr-5 ${
          card.completed ? 'text-gray-500 line-through' : 'text-gray-900'
        }`}>{card.title}</p>
        
        {/* Icon container - positioned on the right */}
        <div className="absolute right-3 top-3">
          {/* Description icon - visible when not hovering (if card has description) */}
          {hasDescription && (
            <span
              className="text-gray-400 block group-hover:hidden"
              title="Has description"
            >
              <svg
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
                <line x1="17" y1="10" x2="3" y2="10" />
                <line x1="21" y1="6" x2="3" y2="6" />
                <line x1="21" y1="14" x2="3" y2="14" />
                <line x1="17" y1="18" x2="3" y2="18" />
              </svg>
            </span>
          )}

          {/* Delete button - visible on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering card click
              onDelete();
            }}
            className="text-gray-300 hover:text-red-500 transition-colors hidden group-hover:block"
            title="Delete card"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
