'use client';

import { useEffect, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { BoardType, Card as CardType, ListActions, ViewMode } from './types';
import { findListIdOfCard } from './lib/board';
import { useAuth } from './components/AuthProvider';
import { useBoard } from './hooks/useBoard';
import { useBoardDragAndDrop } from './hooks/useBoardDragAndDrop';
import { useDragToScroll } from './hooks/useDragToScroll';
import Header from './components/Header';
import SignInScreen from './components/SignInScreen';
import SortableList from './components/SortableList';
import AddListForm from './components/AddListForm';
import { CardDragPreview, ListDragPreview } from './components/DragPreview';
import CardDetailsModal from './components/CardDetailsModal';
import SaveErrorBanner from './components/SaveErrorBanner';

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, signOut, isDevBypass } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('work');
  const board: BoardType = viewMode.startsWith('personal') ? 'personal' : 'work';
  const isArchiveView = viewMode.includes('archive');

  const [searchQuery, setSearchQuery] = useState('');
  // The search the board actually shows: follows the input once typing pauses
  const [activeSearch, setActiveSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setActiveSearch(searchQuery), searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);

  const boardData = useBoard({ user, authLoading, isDevBypass, board, isArchiveView, search: activeSearch });
  const { lists } = boardData;
  const dragAndDrop = useBoardDragAndDrop(boardData);
  const { ref: boardRef, isDragging: isDraggingBoard, handlers: dragToScrollHandlers } = useDragToScroll<HTMLElement>();

  const listActions: ListActions = {
    createCard: boardData.createCard,
    deleteCard: boardData.deleteCard,
    openCard: (cardId) => setSelectedCard(lists.flatMap((l) => l.cards || []).find((c) => c.id === cardId) ?? null),
    toggleComplete: boardData.toggleComplete,
    renameList: boardData.renameList,
    setArchived: boardData.setArchived,
    moveList: boardData.moveList,
    toggleShared: boardData.toggleShared,
    toggleMinimized: boardData.toggleMinimized,
    resizeList: boardData.resizeList,
    resizeListEnd: boardData.resizeListEnd,
  };

  if (authLoading || boardData.loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 text-sm">Loading your board...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignInScreen onSignIn={signInWithGoogle} />;
  }

  if (boardData.error) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <p className="text-red-400">{boardData.error}</p>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-gradient-dark">
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        user={user}
        onSignOut={signOut}
      />

      {/* Board */}
      <main
        ref={boardRef}
        className={`p-3 pb-8 overflow-x-auto overflow-y-hidden hide-scrollbar relative mobile-scroll flex-1 ${isDraggingBoard ? 'cursor-grabbing select-none' : ''}`}
        {...dragToScrollHandlers}
      >
        <DndContext {...dragAndDrop.dndContextProps}>
          <SortableContext items={lists.map((list) => `list-${list.id}`)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 items-start pr-8 h-full">
              {lists.map((list) => (
                <SortableList key={list.id} list={list} actions={listActions} searchQuery={activeSearch} />
              ))}

              {!isArchiveView && <AddListForm onCreate={boardData.createList} />}
            </div>
          </SortableContext>

          {/* Shows the item being dragged */}
          <DragOverlay>
            {dragAndDrop.activeCard && (
              <CardDragPreview card={dragAndDrop.activeCard} listWidth={dragAndDrop.activeCardListWidth} />
            )}
            {dragAndDrop.activeList && <ListDragPreview list={dragAndDrop.activeList} />}
          </DragOverlay>
        </DndContext>
      </main>

      {selectedCard && (
        <CardDetailsModal
          key={selectedCard.id}
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSave={boardData.saveCardDetails}
          onDelete={(cardId) => {
            const listId = findListIdOfCard(lists, cardId);
            if (listId) boardData.deleteCard(cardId, listId);
          }}
        />
      )}

      {boardData.saveError && (
        <SaveErrorBanner
          message={boardData.saveError}
          onReload={boardData.reload}
          onDismiss={boardData.dismissSaveError}
        />
      )}
    </div>
  );
}
