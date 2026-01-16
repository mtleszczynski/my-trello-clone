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
  onRenameList: (listId: string, newTitle: string) => void;
  onCardClick?: (cardId: string) => void;
  onToggleComplete?: (cardId: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

export default function List({ list, onCreateCard, onDeleteCard, onDeleteList, onResize, onRenameList, onCardClick, onToggleComplete, dragHandleProps }: ListProps) {
  // State for adding a new card
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  
  // State for editing list title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
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

  // Handle starting title edit
  function handleStartEditingTitle() {
    setEditedTitle(list.title);
    setIsEditingTitle(true);
    // Focus the input after React renders it
    setTimeout(() => titleInputRef.current?.select(), 0);
  }

  // Handle saving the edited title
  function handleSaveTitle() {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== list.title) {
      onRenameList(list.id, trimmedTitle);
    }
    setIsEditingTitle(false);
  }

  // Handle title input keyboard shortcuts
  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    }
    if (e.key === 'Escape') {
      setEditedTitle(list.title);
      setIsEditingTitle(false);
    }
  }

  // Handle resize start (mouse)
  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }

  // Handle resize start (touch)
  function handleResizeTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    setIsResizing(true);
  }

  // Handle resize during drag (mouse and touch)
  useEffect(() => {
    if (!isResizing) return;

    function handleMove(clientX: number) {
      if (!listRef.current) return;
      
      const rect = listRef.current.getBoundingClientRect();
      const newWidth = clientX - rect.left;
      
      // Enforce min/max constraints
      const constrainedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      
      // Update width immediately (optimistic update)
      onResize(list.id, constrainedWidth);
    }

    function handleMouseMove(e: MouseEvent) {
      handleMove(e.clientX);
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    }

    function handleEnd() {
      setIsResizing(false);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);
    
    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.userSelect = '';
    };
  }, [isResizing, list.id, onResize]);

  return (
    <div
      ref={listRef}
      className="flex-shrink-0 flex flex-col glass rounded-md max-h-[calc(100vh-80px)] relative group"
      style={{ width: `${list.width}px` }}
    >
      {/* List Header */}
      <div className="px-2.5 py-2 flex items-center justify-between gap-1.5 border-b border-slate-200/60">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 touch-none transition-colors"
          title="Drag to reorder"
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
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </div>
        
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleTitleKeyDown}
            className="font-medium text-slate-700 flex-1 text-sm bg-white border border-blue-500 rounded px-1.5 py-0.5 focus:outline-none"
          />
        ) : (
          <span
            onClick={handleStartEditingTitle}
            className="font-medium text-slate-700 flex-1 text-sm cursor-pointer hover:bg-slate-200/50 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5"
            title="Click to rename"
          >
            {list.title}
          </span>
        )}
        
        {/* Resize Handle */}
        <button
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeTouchStart}
          className="text-slate-400 hover:text-blue-500 transition-colors p-0.5"
          title="Resize list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      </div>

      {/* Cards Container - Droppable Area */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 flex flex-col gap-1.5 min-h-[40px] custom-scrollbar"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {sortedCards.length > 0 ? (
            sortedCards.map((card) => (
              <SortableCard
                key={card.id}
                card={card}
                onDelete={() => onDeleteCard(card.id, list.id)}
                onClick={() => onCardClick?.(card.id)}
                onToggleComplete={() => onToggleComplete?.(card.id)}
              />
            ))
          ) : (
            !isAddingCard && (
              <p className="text-slate-400 text-xs text-center py-3">
                No cards yet
              </p>
            )
          )}
        </SortableContext>
      </div>

      {/* Add Card Section */}
      <div className="p-1.5 border-t border-slate-200/60">
        {isAddingCard ? (
          <div>
            <textarea
              placeholder="Enter a title for this card..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={2}
              className="w-full px-2 py-1.5 rounded bg-white border border-slate-300 focus:outline-none focus:border-blue-500 resize-none text-base sm:text-sm text-slate-700 placeholder-slate-400"
            />
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleCreateCard}
                className="bg-blue-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-blue-500 transition-colors"
              >
                Add card
              </button>
              <button
                onClick={() => {
                  setNewCardTitle('');
                  setIsAddingCard(false);
                }}
                className="text-slate-400 hover:text-slate-600 px-1.5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsAddingCard(true)}
              className="text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded hover:bg-slate-200/50 transition-colors text-xs"
            >
              + Add a card
            </button>
            <button
              onClick={handleDeleteList}
              className="text-slate-400 hover:text-red-500 transition-colors p-1.5"
              title="Delete list"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
