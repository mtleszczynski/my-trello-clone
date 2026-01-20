'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType } from '../types';
import Card from './Card';

interface SortableCardProps {
  card: CardType;
  onDelete: () => void;
  onClick?: () => void;
  onToggleComplete?: () => void;
  searchQuery?: string;
}

export default function SortableCard({ card, onDelete, onClick, onToggleComplete, searchQuery }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1, // Fade out the original when dragging (DragOverlay shows the copy)
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card card={card} onDelete={onDelete} onClick={onClick} onToggleComplete={onToggleComplete} searchQuery={searchQuery} />
    </div>
  );
}
