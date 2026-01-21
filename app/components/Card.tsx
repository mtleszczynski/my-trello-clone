'use client';

import { Card as CardType } from '../types';
import { highlightText } from '../lib/highlightText';

interface CardProps {
  card: CardType;
  onDelete: () => void;
  onClick?: () => void;
  onToggleComplete?: () => void;
  searchQuery?: string;
}

export default function Card({ card, onDelete, onClick, onToggleComplete, searchQuery = '' }: CardProps) {
  const hasDescription = card.description && card.description.trim().length > 0;
  
  // Check if search matches the description
  const descriptionMatchesSearch = searchQuery.trim() && hasDescription && 
    card.description.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div 
      className={`group rounded-md p-2 cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all relative shadow-sm ${
        card.completed 
          ? 'bg-emerald-50 border-l-2 border-emerald-400' 
          : 'bg-white hover:translate-y-[-1px] hover:shadow-md'
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
          className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-all ${
            card.completed
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50'
          }`}
          title={card.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {card.completed && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="8"
              height="8"
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

        <p className={`text-xs flex-1 pr-4 leading-relaxed ${
          card.completed ? 'text-slate-600' : 'text-slate-900'
        }`}>{highlightText(card.title, searchQuery)}</p>
        
        {/* Icon container - positioned on the right */}
        <div className="absolute right-2 top-2">
          {/* Description icon - visible when not hovering (if card has description) */}
          {hasDescription && (
            <span
              className={`block group-hover:hidden ${
                descriptionMatchesSearch 
                  ? 'text-yellow-500 bg-yellow-100 rounded p-0.5 -m-0.5' 
                  : 'text-slate-400'
              }`}
              title={descriptionMatchesSearch ? 'Description matches search' : 'Has description'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
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
              if (window.confirm(`Delete "${card.title}"?`)) {
                onDelete();
              }
            }}
            className="text-slate-300 hover:text-red-500 transition-colors hidden group-hover:block"
            title="Delete card"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
