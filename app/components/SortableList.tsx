'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { List as ListType, BoardType } from '../types';
import List from './List';

interface SortableListProps {
  list: ListType;
  onCreateCard: (listId: string, title: string) => void;
  onDeleteCard: (cardId: string, listId: string) => void;
  onArchiveList: (listId: string) => void;
  onMoveList?: (listId: string, targetBoard: BoardType) => void;
  onResize: (listId: string, newWidth: number) => void;
  onResizeEnd?: (listId: string, newWidth: number) => void;
  onRenameList: (listId: string, newTitle: string) => void;
  onToggleShared?: (listId: string) => void;
  onToggleMinimized?: (listId: string) => void;
  onCardClick?: (cardId: string) => void;
  onToggleComplete?: (cardId: string) => void;
  isArchiveView?: boolean;
  searchQuery?: string;
}

export default function SortableList({
  list,
  onCreateCard,
  onDeleteCard,
  onArchiveList,
  onMoveList,
  onResize,
  onResizeEnd,
  onRenameList,
  onToggleShared,
  onToggleMinimized,
  onCardClick,
  onToggleComplete,
  isArchiveView,
  searchQuery,
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
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          width: list.minimized ? '40px' : `${list.width}px`,
          minHeight: '80px',
        }}
        className="flex-shrink-0 rounded-lg border-2 border-dashed border-slate-300/70 bg-slate-200/30 backdrop-blur-sm"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <List
        list={list}
        onCreateCard={onCreateCard}
        onDeleteCard={onDeleteCard}
        onArchiveList={onArchiveList}
        onMoveList={onMoveList}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        onRenameList={onRenameList}
        onToggleShared={onToggleShared}
        onToggleMinimized={onToggleMinimized}
        onCardClick={onCardClick}
        onToggleComplete={onToggleComplete}
        isArchiveView={isArchiveView}
        searchQuery={searchQuery}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
