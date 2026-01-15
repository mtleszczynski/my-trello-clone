'use client';

import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
}

export default function Card({ card }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-3 cursor-pointer hover:bg-gray-50 transition-colors">
      <p className="text-gray-900 text-sm">{card.title}</p>
    </div>
  );
}
