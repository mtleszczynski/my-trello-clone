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

export interface List {
  id: string;
  title: string;
  position: number;
  width: number;
  archived: boolean;
  board: BoardType;
  user_id: string;
  created_at: string;
  cards?: Card[];
}
