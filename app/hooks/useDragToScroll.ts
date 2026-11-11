'use client';

import { useRef, useState } from 'react';

// Scroll the board sideways by dragging on its empty background
export function useDragToScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);

  function stop() {
    if (isDragging) {
      setIsDragging(false);
      document.body.style.userSelect = '';
    }
  }

  const handlers = {
    onMouseDown(e: React.MouseEvent) {
      // Only on empty board space, not on lists, buttons or text fields
      const target = e.target as HTMLElement;
      const isOnSomething = target.closest('.glass, button, input, textarea');

      if (!isOnSomething && ref.current) {
        setIsDragging(true);
        dragStartX.current = e.clientX;
        scrollStartX.current = ref.current.scrollLeft;
        document.body.style.userSelect = 'none';
      }
    },
    onMouseMove(e: React.MouseEvent) {
      if (!isDragging || !ref.current) return;
      ref.current.scrollLeft = scrollStartX.current - (e.clientX - dragStartX.current);
    },
    onMouseUp: stop,
    onMouseLeave: stop,
  };

  return { ref, isDragging, handlers };
}
