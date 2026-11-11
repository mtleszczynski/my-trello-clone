import { test, expect } from '@playwright/test';
import {
  applyPositionUpdates,
  nextPosition,
  positionBetween,
  repositionAfterMove,
  sortByPosition,
} from '../app/lib/positions';

test('positionBetween picks a spot between neighbours', () => {
  expect(positionBetween()).toBe(0);
  expect(positionBetween(undefined, 3)).toBe(2);
  expect(positionBetween(3)).toBe(4);
  expect(positionBetween(1, 2)).toBe(1.5);
  expect(positionBetween(2, 2)).toBeNull();
});

test('nextPosition goes after the highest position', () => {
  expect(nextPosition([])).toBe(0);
  expect(nextPosition([{ id: 'a', position: 0 }, { id: 'b', position: 7 }])).toBe(8);
});

test('repositionAfterMove only updates the moved item when there is room', () => {
  const ordered = [{ id: 'a', position: 0 }, { id: 'c', position: 2 }, { id: 'b', position: 1 }];
  expect(repositionAfterMove(ordered, 'c')).toEqual([{ id: 'c', position: 0.5 }]);
});

test('repositionAfterMove renumbers when neighbours share a position', () => {
  const ordered = [{ id: 'a', position: 0 }, { id: 'x', position: 1 }, { id: 'b', position: 1 }, { id: 'c', position: 1 }];
  expect(repositionAfterMove(ordered, 'b')).toEqual([{ id: 'b', position: 2 }, { id: 'c', position: 3 }]);
});

test('200 inserts at the same spot keep the right order', () => {
  let items = [{ id: 'first', position: 0 }, { id: 'last', position: 1 }];
  for (let i = 0; i < 200; i++) {
    const sorted = sortByPosition(items);
    const moved = { id: `new-${i}`, position: 999 };
    const order = [sorted[0], moved, ...sorted.slice(1)];
    items = applyPositionUpdates([...items, moved], repositionAfterMove(order, moved.id));
    expect(sortByPosition(items).map((item) => item.id)).toEqual(order.map((item) => item.id));
  }
});
