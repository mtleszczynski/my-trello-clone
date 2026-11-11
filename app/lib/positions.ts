// Helpers for ordering cards and lists by their `position` value.
//
// Positions are fractional: moving an item gives it a position halfway between its new
// neighbours, so only the moved item has to be saved (instead of renumbering a whole list).

export interface Positioned {
  id: string;
  position: number;
}

export interface PositionUpdate {
  id: string;
  position: number;
}

export function sortByPosition<T extends Positioned>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

// Position for a new item added to the end
export function nextPosition(items: Positioned[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.position)) + 1;
}

// A position strictly between two neighbours, or null if there is no room
// (the neighbours share a position, or floating point precision ran out)
export function positionBetween(before?: number, after?: number): number | null {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;

  const middle = (before + after) / 2;
  return middle > before && middle < after ? middle : null;
}

// Given the final order of items (including the moved one), return the position updates to save.
// Normally that is just the moved item; if there's no room between its neighbours, the whole
// list is renumbered 0, 1, 2, ...
export function repositionAfterMove(ordered: Positioned[], movedId: string): PositionUpdate[] {
  const index = ordered.findIndex((item) => item.id === movedId);
  if (index === -1) return [];

  const position = positionBetween(ordered[index - 1]?.position, ordered[index + 1]?.position);
  if (position !== null) return [{ id: movedId, position }];

  return ordered
    .map((item, i) => ({ item, position: i }))
    .filter(({ item, position }) => item.position !== position || item.id === movedId)
    .map(({ item, position }) => ({ id: item.id, position }));
}

export function applyPositionUpdates<T extends Positioned>(items: T[], updates: PositionUpdate[]): T[] {
  const byId = new Map(updates.map((update) => [update.id, update.position]));
  return items.map((item) => (byId.has(item.id) ? { ...item, position: byId.get(item.id)! } : item));
}
