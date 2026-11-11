'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { List as ListType, ListActions } from '../types';
import List from './List';

interface SortableListProps {
  list: ListType;
  actions: ListActions;
  searchQuery?: string;
}

export default function SortableList({ list, actions, searchQuery }: SortableListProps) {
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
    <div ref={setNodeRef} style={style} className="h-full">
      <List
        list={list}
        actions={actions}
        searchQuery={searchQuery}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
