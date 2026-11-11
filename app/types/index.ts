// Types for our Trello clone

export interface Card {
  id: string;
  title: string;
  description: string;
  position: number;
  list_id: string;
  user_id: string;
  completed: boolean;
  created_at: string;
}

export type BoardType = 'work' | 'personal';

// Which tab is showing: a board, or that board's archive
export type ViewMode = 'work' | 'personal' | 'work-archive' | 'personal-archive';

export interface List {
  id: string;
  title: string;
  position: number;
  width: number;
  archived: boolean;
  board: BoardType;
  shared: boolean;
  minimized: boolean;
  user_id: string;
  created_at: string;
  cards?: Card[];
}

// Everything a list (and the cards in it) can ask the board to do
export interface ListActions {
  createCard: (listId: string, title: string) => void;
  deleteCard: (cardId: string, listId: string) => void;
  openCard: (cardId: string) => void;
  toggleComplete: (cardId: string) => void;
  renameList: (listId: string, title: string) => void;
  setArchived: (listId: string, archived: boolean) => void;
  moveList: (listId: string, board: BoardType) => void;
  toggleShared: (listId: string) => void;
  toggleMinimized: (listId: string) => void;
  resizeList: (listId: string, width: number) => void;
  resizeListEnd: (listId: string, width: number) => void;
}
