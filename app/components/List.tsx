'use client';

import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { List as ListType, BoardType } from '../types';
import SortableCard from './SortableCard';
import { highlightText } from '../lib/highlightText';

interface ListProps {
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
  dragHandleProps?: Record<string, unknown>;
}

export default function List({ list, onCreateCard, onDeleteCard, onArchiveList, onMoveList, onResize, onResizeEnd, onRenameList, onToggleShared, onToggleMinimized, onCardClick, onToggleComplete, isArchiveView = false, searchQuery = '', dragHandleProps }: ListProps) {
  // State for adding a new card
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  
  // State for editing list title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // State for move dropdown
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const moveDropdownRef = useRef<HTMLDivElement>(null);
  
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

  // Handle archiving/unarchiving the list (with confirmation)
  function handleArchiveList() {
    const cardCount = (list.cards || []).length;
    const action = isArchiveView ? 'Unarchive' : 'Archive';
    const message = cardCount > 0
      ? `${action} "${list.title}" and its ${cardCount} card${cardCount > 1 ? 's' : ''}?`
      : `${action} "${list.title}"?`;
    
    if (window.confirm(message)) {
      onArchiveList(list.id);
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

  // Track the current width during resize
  const currentWidthRef = useRef(list.width);
  
  // Keep the ref in sync with prop when not resizing
  useEffect(() => {
    if (!isResizing) {
      currentWidthRef.current = list.width;
    }
  }, [list.width, isResizing]);

  // Handle resize during drag (mouse and touch)
  useEffect(() => {
    if (!isResizing) return;

    function handleMove(clientX: number) {
      if (!listRef.current) return;
      
      const rect = listRef.current.getBoundingClientRect();
      const newWidth = clientX - rect.left;
      
      // Enforce min/max constraints
      const constrainedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      
      // Track the current width
      currentWidthRef.current = constrainedWidth;
      
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
      // Save the final width to database
      onResizeEnd?.(list.id, currentWidthRef.current);
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
  }, [isResizing, list.id, onResize, onResizeEnd]);

  // Close move dropdown when clicking outside
  useEffect(() => {
    if (!showMoveDropdown) return;
    
    function handleClickOutside(e: MouseEvent) {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(e.target as Node)) {
        setShowMoveDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoveDropdown]);

  // Minimized view
  if (list.minimized) {
    return (
      <div
        ref={listRef}
        className="flex-shrink-0 flex flex-col glass rounded-md max-h-[calc(100vh-80px)] relative items-center"
        style={{ width: '40px' }}
      >
        {/* Expand button + drag handle area */}
        <div className="py-2 flex flex-col items-center gap-1 border-b border-slate-200/60 w-full">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 touch-none transition-colors"
            title="Drag to reorder"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
          {/* Expand button */}
          <button
            onClick={() => onToggleMinimized?.(list.id)}
            className="text-slate-400 hover:text-blue-500 transition-colors p-0.5"
            title="Expand list"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          </button>
        </div>

        {/* Vertical title + checkboxes area */}
        <div
          ref={setNodeRef}
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center gap-1 py-2 min-h-[40px] custom-scrollbar w-full"
        >
          {/* Vertical title */}
          <div className="relative w-full flex justify-center" style={{ height: `${Math.max(60, list.title.length * 7)}px` }}>
            <span
              className="absolute font-medium text-slate-500 text-[11px] whitespace-nowrap origin-center"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
              }}
              title={list.title}
            >
              {list.title}
            </span>
          </div>

          {/* Checkbox-only cards (read-only) */}
          {sortedCards.length > 0 && (
            <div className="flex flex-col items-center gap-1 mt-1">
              {sortedCards.map((card) => (
                <div
                  key={card.id}
                  className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                    card.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                  title={card.title}
                >
                  {card.completed && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span
              onClick={handleStartEditingTitle}
              className="font-medium text-slate-700 text-sm cursor-pointer hover:bg-slate-200/50 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 truncate"
              title="Click to rename"
            >
              {highlightText(list.title, searchQuery)}
            </span>
            {/* Show board badge when searching */}
            {searchQuery && (
              <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                list.board === 'personal' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {list.board === 'personal' ? 'Pers' : 'Work'}
              </span>
            )}
            {/* Show Archived badge when searching and list is archived */}
            {searchQuery && list.archived && (
              <span className="flex-shrink-0 text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                Archived
              </span>
            )}
          </div>
        )}
        
        {/* Share Toggle - only show when not in archive view */}
        {!isArchiveView && onToggleShared && (
          <button
            onClick={() => onToggleShared(list.id)}
            className={`transition-colors p-0.5 ${
              list.shared
                ? 'text-blue-500 hover:text-blue-600'
                : 'text-slate-400 hover:text-blue-500'
            }`}
            title={list.shared ? 'Shared across boards (click to unshare)' : 'Share across boards'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </button>
        )}
        
        {/* Minimize Button */}
        {!isArchiveView && onToggleMinimized && (
          <button
            onClick={() => onToggleMinimized(list.id)}
            className="text-slate-400 hover:text-blue-500 transition-colors p-0.5"
            title="Minimize list"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7"></polyline>
              <polyline points="18 17 13 12 18 7"></polyline>
            </svg>
          </button>
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
                searchQuery={searchQuery}
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
            <div className="flex items-center gap-0.5">
              {/* Move to board button - only show when not in archive view */}
              {!isArchiveView && onMoveList && (
                <div className="relative" ref={moveDropdownRef}>
                  <button
                    onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                    className="text-slate-400 hover:text-blue-500 transition-colors p-1.5"
                    title="Move to another board"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </button>
                  {showMoveDropdown && (
                    <div className="absolute bottom-full right-0 mb-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[120px] z-10">
                      <div className="px-2 py-1 text-[10px] font-medium text-slate-400 uppercase">Move to</div>
                      <button
                        onClick={() => {
                          onMoveList(list.id, 'work');
                          setShowMoveDropdown(false);
                        }}
                        disabled={list.board === 'work'}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          list.board === 'work'
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Work {list.board === 'work' && '✓'}
                      </button>
                      <button
                        onClick={() => {
                          onMoveList(list.id, 'personal');
                          setShowMoveDropdown(false);
                        }}
                        disabled={list.board === 'personal'}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          list.board === 'personal'
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Personal {list.board === 'personal' && '✓'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Archive button */}
              <button
                onClick={handleArchiveList}
                className={`transition-colors p-1.5 ${
                  isArchiveView 
                    ? 'text-slate-400 hover:text-emerald-500' 
                    : 'text-slate-400 hover:text-amber-500'
                }`}
                title={isArchiveView ? 'Unarchive list' : 'Archive list'}
              >
                {isArchiveView ? (
                  // Unarchive icon (arrow coming out of box)
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 11 12 6 7 11"></polyline>
                    <line x1="12" y1="6" x2="12" y2="18"></line>
                    <path d="M5 21h14a2 2 0 0 0 2-2v-5H3v5a2 2 0 0 0 2 2z"></path>
                  </svg>
                ) : (
                  // Archive icon (box with arrow going in)
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8"></polyline>
                    <rect x="1" y="3" width="22" height="5"></rect>
                    <line x1="10" y1="12" x2="14" y2="12"></line>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
