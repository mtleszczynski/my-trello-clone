'use client';

import { Card as CardType, List as ListType } from '../types';

// What follows the pointer while dragging a card
export function CardDragPreview({ card, listWidth }: { card: CardType; listWidth: number }) {
  return (
    <div className="bg-white rounded-md shadow-xl p-2 rotate-2" style={{ width: `${listWidth - 12}px` }}>
      <div className="flex items-start gap-2">
        {/* Checkbox visual */}
        <div className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center ${
          card.completed
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-slate-300'
        }`}>
          {card.completed && (
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <p className={`text-xs flex-1 leading-relaxed ${
          card.completed ? 'text-slate-400 line-through' : 'text-slate-700'
        }`}>{card.title}</p>
      </div>
    </div>
  );
}

// What follows the pointer while dragging a list
export function ListDragPreview({ list }: { list: ListType }) {
  if (list.minimized) {
    return (
      <div className="glass rounded-md shadow-xl py-2.5 px-1 rotate-1 flex flex-col items-center" style={{ width: '40px' }}>
        <span
          className="font-medium text-slate-500 text-[11px] whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {list.title}
        </span>
      </div>
    );
  }

  const cardCount = (list.cards || []).length;
  return (
    <div className="glass rounded-md shadow-xl p-2.5 rotate-1" style={{ width: `${list.width}px` }}>
      <p className="font-medium text-slate-700 text-sm">{list.title}</p>
      <p className="text-slate-500 text-xs mt-1">
        {cardCount} card{cardCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
