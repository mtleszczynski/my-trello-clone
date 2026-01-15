'use client';

import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { List as ListType } from '../types';
import SortableCard from './SortableCard';

interface ListProps {
  list: ListType;
  onCreateCard: (listId: string, title: string) => void;
  onDeleteCard: (cardId: string, listId: string) => void;
  onDeleteList: (listId: string) => void;
  onResize: (listId: string, newWidth: number) => void;
  dragHandleProps?: Record<string, unknown>;
}

export default function List({ list, onCreateCard, onDeleteCard, onDeleteList, onResize, dragHandleProps }: ListProps) {
  // State for adding a new card
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  
  // State for resizing
  const [isResizing, setIsResizing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;

  // Make this list a droppable area
  const { setNodeRef } = useDroppable({
    id: list.id,
  });

  // Sort cards by position
  const sortedCards = [...(list.cards || [])].sort((a, b) => a.position - b.position);
  const cardIds = sortedCards.map((card) => card.id);

  // Handle creating a new card
  function handleCreateCard() {
    if (!newCardTitle.trim()) return;
    
    onCreateCard(list.id, newCardTitle.trim());
    setNewCardTitle('');
    setIsAddingCard(false);
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleCreateCard();
    }
    if (e.key === 'Escape') {
      setNewCardTitle('');
      setIsAddingCard(false);
    }
  }

  // Handle deleting the list (with confirmation)
  function handleDeleteList() {
    const cardCount = (list.cards || []).length;
    const message = cardCount > 0
      ? `Delete "${list.title}" and its ${cardCount} card${cardCount > 1 ? 's' : ''}?`
      : `Delete "${list.title}"?`;
    
    if (window.confirm(message)) {
      onDeleteList(list.id);
    }
  }

  // Handle resize start
  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }

  // Handle resize during drag
  useEffect(() => {
    if (!isResizing) return;

    function handleMouseMove(e: MouseEvent) {
      if (!listRef.current) return;
      
      const rect = listRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      
      // Enforce min/max constraints
      const constrainedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      
      // Update width immediately (optimistic update)
      onResize(list.id, constrainedWidth);
    }

    function handleMouseUp() {
      setIsResizing(false);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, list.id, onResize]);

  return (
    <div
      ref={listRef}
      className="flex-shrink-0 flex flex-col bg-gray-100 rounded-lg max-h-[calc(100vh-120px)] relative group"
      style={{ width: `${list.width}px` }}
    >
      {/* List Header */}
      <div className="group/header p-3 flex items-center justify-between gap-2">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
          title="Drag to reorder"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </div>
        
        <span className="font-semibold text-gray-900 flex-1">{list.title}</span>
        
        <button
          onClick={handleDeleteList}
          className="text-gray-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover/header:opacity-100"
          title="Delete list"
        >
          ✕
        </button>
      </div>

      {/* Cards Container - Droppable Area */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-2 min-h-[50px]"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {sortedCards.length > 0 ? (
            sortedCards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                onDelete={() => onDeleteCard(card.id, list.id)}
              />
            ))
          ) : (
            !isAddingCard && (
              <p className="text-gray-400 text-sm text-center py-4">
                No cards yet
              </p>
            )
          )}
        </SortableContext>
      </div>

      {/* Add Card Section */}
      <div className="p-2">
        {isAddingCard ? (
          <div>
            <textarea
              placeholder="Enter a title for this card..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
              className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:border-blue-500 resize-none text-sm"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreateCard}
                className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors text-sm"
              >
                Add card
              </button>
              <button
                onClick={() => {
                  setNewCardTitle('');
                  setIsAddingCard(false);
                }}
                className="text-gray-500 hover:text-gray-700 px-2"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            className="w-full text-left text-gray-500 hover:text-gray-700 p-2 rounded hover:bg-gray-200 transition-colors"
          >
            + Add a card
          </button>
        )}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:w-3 hover:bg-blue-500 transition-all group-hover:bg-blue-400/50 z-10"
        style={{ 
          cursor: isResizing ? 'col-resize' : 'col-resize',
        }}
        title="Drag to resize"
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-400 group-hover:bg-blue-500" />
      </div>
    </div>
  );
}
