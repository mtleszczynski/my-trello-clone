'use client';

import { useRef, useState } from 'react';
import {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { findDropTarget, findListIdOfCard } from '../lib/board';
import {
  applyPositionUpdates,
  positionBetween,
  PositionUpdate,
  repositionAfterMove,
  sortByPosition,
} from '../lib/positions';
import { Card as CardType, List as ListType } from '../types';

interface UseBoardDragAndDropOptions {
  lists: ListType[];
  setLists: React.Dispatch<React.SetStateAction<ListType[]>>;
  saveCardPositions: (updates: PositionUpdate[], movedCardId: string, listId: string) => void;
  saveListPositions: (updates: PositionUpdate[]) => void;
}

// Dragging cards (within and between lists) and lists (to reorder them).
// Returns props for <DndContext> plus the item being dragged, for the drag preview.
export function useBoardDragAndDrop({ lists, setLists, saveCardPositions, saveListPositions }: UseBoardDragAndDropOptions) {
  // State for tracking the currently dragged item
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [activeCardListWidth, setActiveCardListWidth] = useState<number>(300);
  const [activeList, setActiveList] = useState<ListType | null>(null);

  // Board as it was when the current drag started (restored if the drag is cancelled)
  const dragSnapshot = useRef<ListType[] | null>(null);

  // Set up drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold to start drag on touch
        tolerance: 5,
      },
    })
  );

  // Custom collision detection: when dragging a list, only consider list droppables
  // (ignore card droppables so the list SortableContext gets the correct overIndex)
  const customCollisionDetection: CollisionDetection = (args) => {
    const activeId = args.active.id as string;

    if (activeId.startsWith('list-')) {
      // Filter to only list droppables so the sort transform works correctly
      const listContainers = (args.droppableContainers as { id: string | number }[]).filter(
        (container) => (container.id as string).startsWith('list-')
      );
      return closestCorners({
        ...args,
        droppableContainers: listContainers as typeof args.droppableContainers,
      });
    }

    // For cards, use default closestCorners with all droppables
    return closestCorners(args);
  };

  // Handle drag start - track which item is being dragged
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const activeId = active.id as string;
    dragSnapshot.current = lists;
    
    // Check if dragging a list
    if (activeId.startsWith('list-')) {
      const listId = activeId.replace('list-', '');
      const list = lists.find((l) => l.id === listId);
      if (list) {
        setActiveList(list);
        setActiveCard(null);
      }
      return;
    }
    
    // Otherwise, dragging a card
    for (const list of lists) {
      const card = (list.cards || []).find((c) => c.id === activeId);
      if (card) {
        setActiveCard(card);
        setActiveCardListWidth(list.width);
        setActiveList(null);
        break;
      }
    }
  }

  // Handle drag over - move the card into another list while dragging, so it can be previewed there.
  // Reordering within a list is previewed by @dnd-kit itself and applied in handleDragEnd.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId.startsWith('list-')) return;

    setLists((prevLists) => {
      const fromListId = findListIdOfCard(prevLists, activeId);
      const target = findDropTarget(prevLists, overId);
      if (!fromListId || !target || target.listId === fromListId) return prevLists;

      const movingCard = prevLists
        .find((l) => l.id === fromListId)!
        .cards!.find((c) => c.id === activeId)!;

      return prevLists.map((list) => {
        if (list.id === fromListId) {
          return { ...list, cards: (list.cards || []).filter((c) => c.id !== activeId) };
        }
        if (list.id !== target.listId) return list;

        // Insert just above the card we're over, or at the bottom of the list
        let destCards = sortByPosition(list.cards || []);
        const overIndex = destCards.findIndex((c) => c.id === target.overCardId);
        const insertIndex = overIndex === -1 ? destCards.length : overIndex;

        let previewPosition = positionBetween(
          destCards[insertIndex - 1]?.position,
          destCards[insertIndex]?.position
        );
        if (previewPosition === null) {
          // Neighbours share a position; renumber this preview (the real save is worked out on drop)
          destCards = destCards.map((card, index) => ({ ...card, position: index }));
          previewPosition = insertIndex - 0.5;
        }

        return {
          ...list,
          cards: [...destCards, { ...movingCard, list_id: list.id, position: previewPosition }],
        };
      });
    });
  }

  // Handle drag being cancelled (Escape key, browser taking over the touch for scrolling, etc.)
  function handleDragCancel() {
    if (dragSnapshot.current) {
      setLists(dragSnapshot.current);
    }
    dragSnapshot.current = null;
    setActiveCard(null);
    setActiveList(null);
  }

  // Handle drag end event - save to Supabase
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = active.id as string;
    const snapshot = dragSnapshot.current;

    dragSnapshot.current = null;
    setActiveCard(null);
    setActiveList(null);

    if (!snapshot) return;

    if (activeId.startsWith('list-')) {
      handleListDrop(activeId.replace('list-', ''), over ? (over.id as string) : null);
    } else {
      handleCardDrop(activeId, over ? (over.id as string) : null, snapshot);
    }
  }

  // Save a list's new place on the board
  function handleListDrop(activeListId: string, overId: string | null) {
    if (!overId) return;

    const target = findDropTarget(lists, overId);
    if (!target || target.listId === activeListId) return;

    const oldIndex = lists.findIndex((l) => l.id === activeListId);
    const newIndex = lists.findIndex((l) => l.id === target.listId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedLists = arrayMove(lists, oldIndex, newIndex);
    const updates = repositionAfterMove(reorderedLists, activeListId);
    setLists(applyPositionUpdates(reorderedLists, updates));
    saveListPositions(updates);
  }

  // Save a card's new place. `lists` already has the card in its new list (from handleDragOver);
  // `snapshot` is the board from before the drag, i.e. what's in the database.
  function handleCardDrop(activeId: string, overId: string | null, snapshot: ListType[]) {
    const sourceListId = findListIdOfCard(snapshot, activeId);
    const finalListId = findListIdOfCard(lists, activeId);
    if (!sourceListId || !finalListId) {
      setLists(snapshot);
      return;
    }

    // Final order of the card's list, including a reorder within the list on drop
    let finalOrder = sortByPosition(lists.find((l) => l.id === finalListId)!.cards || []).map((c) => c.id);
    const fromIndex = finalOrder.indexOf(activeId);
    const toIndex = overId ? finalOrder.indexOf(overId) : -1;
    if (toIndex !== -1 && toIndex !== fromIndex) {
      finalOrder = arrayMove(finalOrder, fromIndex, toIndex);
    }

    // Nothing changed
    const originalOrder = sortByPosition(snapshot.find((l) => l.id === sourceListId)!.cards || []).map((c) => c.id);
    if (sourceListId === finalListId && finalOrder.join() === originalOrder.join()) {
      setLists(snapshot);
      return;
    }

    // Work out positions from the database values (the snapshot), not the drag preview
    const snapshotCards = new Map(snapshot.flatMap((l) => l.cards || []).map((c) => [c.id, c]));
    const ordered = finalOrder.map((id) => snapshotCards.get(id)).filter((c): c is CardType => !!c);
    const updates = repositionAfterMove(ordered, activeId);
    const movedCard = { ...snapshotCards.get(activeId)!, list_id: finalListId };

    setLists(
      snapshot.map((list) => {
        if (list.id !== sourceListId && list.id !== finalListId) return list;

        let cards = (list.cards || []).filter((c) => c.id !== activeId);
        if (list.id === finalListId) cards = [...cards, movedCard];
        return { ...list, cards: applyPositionUpdates(cards, updates) };
      })
    );
    saveCardPositions(updates, activeId, finalListId);
  }

  return {
    dndContextProps: {
      sensors,
      collisionDetection: customCollisionDetection,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
    activeCard,
    activeCardListWidth,
    activeList,
  };
}
