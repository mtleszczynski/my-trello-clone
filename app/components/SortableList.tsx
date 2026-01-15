'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { List as ListType } from '../types';
import List from './List';

interface SortableListProps {
  list: ListType;
  onCreateCard: (listId: string, title: string) => void;
  onDeleteCard: (cardId: string, listId: string) => void;
  onDeleteList: (listId: string) => void;
  onResize: (listId: string, newWidth: number) => void;
  onCardClick?: (cardId: string) => void;
}

export default function SortableList({
  list,
  onCreateCard,
  onDeleteCard,
  onDeleteList,
  onResize,
  onCardClick,
}: SortableListProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `list-${list.id}`,
    data: {
      type: 'list',
      list,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <List
        list={list}
        onCreateCard={onCreateCard}
        onDeleteCard={onDeleteCard}
        onDeleteList={onDeleteList}
        onResize={onResize}
        onCardClick={onCardClick}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
