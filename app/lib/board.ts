import { List } from '../types';

// Find the list a card is currently in
export function findListIdOfCard(lists: List[], cardId: string): string | undefined {
  return lists.find((list) => (list.cards || []).some((card) => card.id === cardId))?.id;
}

// Work out which list (and which card in it, if any) something is being dragged over.
// The id can be 'list-{id}' (sortable list), '{id}' (list's card area) or a card id.
export function findDropTarget(lists: List[], overId: string): { listId: string; overCardId: string | null } | null {
  const list = lists.find((l) => l.id === overId || `list-${l.id}` === overId);
  if (list) return { listId: list.id, overCardId: null };

  const listId = findListIdOfCard(lists, overId);
  return listId ? { listId, overCardId: overId } : null;
}
