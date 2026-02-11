'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card as CardType } from '../types';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface CardDetailsModalProps {
  card: CardType | null;
  onClose: () => void;
  onSave: (cardId: string, title: string, description: string) => void;
  onDelete: (cardId: string) => void;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const MIN_HEIGHT = 250;
const DEFAULT_WIDTH = 448;
const DEFAULT_HEIGHT = 320;

// Calculate max height based on viewport (leave some padding)
function getMaxHeight(): number {
  if (typeof window === 'undefined') return 600;
  return Math.max(400, window.innerHeight - 100);
}

// Calculate initial height based on description length
function calculateInitialHeight(description: string): number {
  if (!description) return DEFAULT_HEIGHT;
  
  // Estimate: ~50 chars per line, ~20px per line, plus padding
  const estimatedLines = Math.ceil(description.length / 50);
  const estimatedHeight = DEFAULT_HEIGHT + (estimatedLines * 20);
  
  return Math.max(DEFAULT_HEIGHT, Math.min(getMaxHeight(), estimatedHeight));
}

// Get saved size from localStorage
function getSavedSize(): { width: number; height: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('cardModalSize');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.width && parsed.height) {
        return {
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width)),
          height: Math.max(MIN_HEIGHT, Math.min(getMaxHeight(), parsed.height)),
        };
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Save size to localStorage
function saveSize(size: { width: number; height: number }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cardModalSize', JSON.stringify(size));
  } catch {
    // Ignore errors
  }
}

export default function CardDetailsModal({ card, onClose, onSave, onDelete }: CardDetailsModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedValues = useRef<{ title: string; description: string }>({ title: '', description: '' });

  // Resize state
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const justFinishedResizing = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Save the current values to the database
  const doSave = useCallback((cardId: string, newTitle: string, newDescription: string) => {
    const trimmedTitle = newTitle.trim();
    const trimmedDesc = newDescription.trim();
    
    // Skip if nothing changed since last save
    if (trimmedTitle === lastSavedValues.current.title && trimmedDesc === lastSavedValues.current.description) {
      setSaveStatus('saved');
      return;
    }
    
    setSaveStatus('saving');
    onSave(cardId, trimmedTitle, trimmedDesc);
    lastSavedValues.current = { title: trimmedTitle, description: trimmedDesc };
    
    // Show "Saved" after a brief moment
    if (savedIndicatorTimer.current) clearTimeout(savedIndicatorTimer.current);
    savedIndicatorTimer.current = setTimeout(() => {
      setSaveStatus('saved');
    }, 500);
  }, [onSave]);

  // Schedule a debounced save (1 second after user stops typing)
  const scheduleSave = useCallback((cardId: string, newTitle: string, newDescription: string) => {
    setSaveStatus('unsaved');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      doSave(cardId, newTitle, newDescription);
    }, 1000);
  }, [doSave]);

  // Flush any pending save immediately (used when closing)
  const flushSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (card && saveStatus === 'unsaved') {
      doSave(card.id, title, description);
    }
  }, [card, title, description, saveStatus, doSave]);

  // Handle title change with auto-save
  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    if (card) scheduleSave(card.id, newTitle, description);
  }

  // Handle description change with auto-save
  function handleDescriptionChange(newDescription: string) {
    setDescription(newDescription);
    if (card) scheduleSave(card.id, title, newDescription);
  }

  // Update form when a DIFFERENT card is opened (not when same card's data updates from parent)
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      lastSavedValues.current = { title: card.title, description: card.description || '' };
      setSaveStatus('saved');
    }
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set initial size when modal opens
  useEffect(() => {
    if (card) {
      // First check for saved size
      const savedSize = getSavedSize();
      if (savedSize) {
        // Use saved size, but expand height if description needs more space
        const autoHeight = calculateInitialHeight(card.description || '');
        setSize({
          width: savedSize.width,
          height: Math.max(savedSize.height, autoHeight),
        });
      } else {
        // No saved size - calculate based on description
        setSize({
          width: DEFAULT_WIDTH,
          height: calculateInitialHeight(card.description || ''),
        });
      }
    }
  }, [card?.id, card?.description]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (savedIndicatorTimer.current) clearTimeout(savedIndicatorTimer.current);
    };
  }, []);

  // Handle closing - flush any pending save first
  function handleClose() {
    flushSave();
    onClose();
  }

  // Handle deleting
  function handleDelete() {
    if (!card) return;
    if (window.confirm(`Delete "${card.title}"?`)) {
      // Cancel any pending save since the card is being deleted
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      onDelete(card.id);
      onClose();
    }
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
    // Ctrl/Cmd + Enter to save immediately
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      flushSave();
    }
  }

  // Handle resize
  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }

  // Handle backdrop click - don't close if we just finished resizing
  function handleBackdropClick() {
    if (justFinishedResizing.current) {
      justFinishedResizing.current = false;
      return;
    }
    handleClose();
  }

  // Handle resize during drag
  useEffect(() => {
    if (!isResizing) return;

    function handleMouseMove(e: MouseEvent) {
      if (!modalRef.current) return;
      
      const rect = modalRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const newHeight = e.clientY - rect.top;
      
      const newSize = {
        width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)),
        height: Math.max(MIN_HEIGHT, Math.min(getMaxHeight(), newHeight)),
      };
      
      setSize(newSize);
    }

    function handleMouseUp() {
      setIsResizing(false);
      justFinishedResizing.current = true;
      // Save the size when user finishes resizing
      saveSize(size);
      // Reset the flag after a short delay
      setTimeout(() => {
        justFinishedResizing.current = false;
      }, 100);
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
  }, [isResizing, size]);

  // Don't render if no card
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-3 pt-12 sm:p-4 overflow-hidden"
      onClick={handleBackdropClick}
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
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-slate-700">Card Details</h2>
            {/* Auto-save status indicator */}
            <span className={`text-xs transition-opacity duration-300 ${
              saveStatus === 'saved' ? 'text-emerald-500' :
              saveStatus === 'saving' ? 'text-blue-500' :
              'text-amber-500'
            }`}>
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved
                </span>
              )}
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'unsaved' && 'Editing...'}
            </span>
          </div>
          <button
            onClick={handleClose}
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
              onChange={(e) => handleTitleChange(e.target.value)}
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
              onChange={(e) => handleDescriptionChange(e.target.value)}
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
          <button
            onClick={handleClose}
            className="px-3 py-1.5 bg-slate-600 text-white rounded text-sm font-medium hover:bg-slate-500 transition-colors"
          >
            Close
          </button>
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
