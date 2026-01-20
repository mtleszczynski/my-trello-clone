'use client';

import { useState, useEffect, useRef } from 'react';
import { Card as CardType } from '../types';

interface CardDetailsModalProps {
  card: CardType | null;
  onClose: () => void;
  onSave: (cardId: string, title: string, description: string) => void;
  onDelete: (cardId: string) => void;
}

export default function CardDetailsModal({ card, onClose, onSave, onDelete }: CardDetailsModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Resize state
  const [size, setSize] = useState({ width: 448, height: 320 }); // Default size (max-w-md = 28rem = 448px)
  const [isResizing, setIsResizing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 800;
  const MIN_HEIGHT = 250;
  const MAX_HEIGHT = 600;

  // Update form when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
    }
  }, [card]);

  // Handle saving
  function handleSave() {
    if (!card) return;
    onSave(card.id, title.trim(), description.trim());
    onClose();
  }

  // Handle deleting
  function handleDelete() {
    if (!card) return;
    if (window.confirm(`Delete "${card.title}"?`)) {
      onDelete(card.id);
      onClose();
    }
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
    // Ctrl/Cmd + Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave();
    }
  }

  // Handle resize
  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }

  // Handle resize during drag
  useEffect(() => {
    if (!isResizing) return;

    function handleMouseMove(e: MouseEvent) {
      if (!modalRef.current) return;
      
      const rect = modalRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const newHeight = e.clientY - rect.top;
      
      setSize({
        width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)),
        height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight)),
      });
    }

    function handleMouseUp() {
      setIsResizing(false);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Reset size when modal opens with a new card
  useEffect(() => {
    if (card) {
      setSize({ width: 448, height: 320 });
    }
  }, [card?.id]);

  // Don't render if no card
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-3 pt-12 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-slate-50 rounded-lg shadow-2xl flex flex-col border border-slate-200 relative"
        style={{ width: `${size.width}px`, height: `${size.height}px` }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Card Details</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
            title="Close (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0">
          {/* Title */}
          <div className="mb-3 flex-shrink-0">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 focus:outline-none focus:border-blue-500 text-base sm:text-sm text-slate-700 placeholder-slate-400"
              placeholder="Enter card title..."
            />
          </div>

          {/* Description */}
          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-xs font-medium text-slate-500 mb-1 flex-shrink-0">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full flex-1 px-2.5 py-1.5 rounded bg-white border border-slate-300 focus:outline-none focus:border-blue-500 resize-none text-base sm:text-sm text-slate-700 placeholder-slate-400 min-h-[80px]"
              placeholder="Add a more detailed description..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 sm:px-4 sm:py-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors text-sm"
          >
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-700 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group"
          title="Drag to resize"
        >
          <svg
            className="absolute bottom-1 right-1 text-slate-300 group-hover:text-slate-500 transition-colors"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
          >
            <polygon points="10,0 10,10 0,10" />
          </svg>
        </div>
      </div>
    </div>
  );
}
