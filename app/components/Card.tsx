'use client';

import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onDelete: () => void;
  onClick?: () => void;
}

export default function Card({ card, onDelete, onClick }: CardProps) {
  const hasDescription = card.description && card.description.trim().length > 0;

  return (
    <div 
      className="group bg-white rounded-lg shadow-sm p-3 cursor-pointer hover:bg-gray-50 transition-colors relative"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-900 text-sm flex-1 pr-5">{card.title}</p>
        
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
