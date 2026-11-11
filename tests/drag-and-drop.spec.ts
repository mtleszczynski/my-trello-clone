import { test, expect } from '@playwright/test';
import { useFakeSupabase } from './fake-supabase';
import { card, databaseBoard, drag, listHandle, openBoard, screenBoard } from './helpers';

test('reordering a card within a list saves only that card', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await drag(page, card(page, 'Card D'), card(page, 'Card B'));

  expect((await screenBoard(page))['List One']).toBe('ADBC');
  expect(fake.updates).toEqual([{ table: 'cards', id: 'd', body: { position: 0.5, list_id: 'L1' } }]);
});

test('moving a card to another list saves its new list and position', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await drag(page, card(page, 'Card A'), card(page, 'Card F'));

  const board = await screenBoard(page);
  expect(board['List One']).toBe('BCD');
  expect(board['List Two']).toBe('EAF');
  expect(fake.updates).toEqual([{ table: 'cards', id: 'a', body: { position: 0.5, list_id: 'L2' } }]);
});

test('reordering lists saves only the moved list', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await drag(page, listHandle(page, 'List One'), listHandle(page, 'List Three'), { offsetY: 100 });

  expect(Object.keys(await screenBoard(page))).toEqual(['List Two', 'List Three', 'List One']);
  expect(fake.updates).toEqual([{ table: 'lists', id: 'L1', body: { position: 3 } }]);
});

test('cards that share a position get renumbered when needed', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await drag(page, card(page, 'Card J'), card(page, 'Card I'));

  expect((await screenBoard(page))['List Three']).toBe('GHJI');
  expect(databaseBoard(fake.db)['List Three']).toBe('GHJI');
});

test('cancelling a drag puts everything back and saves nothing', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);
  const before = await screenBoard(page);

  await drag(page, card(page, 'Card A'), card(page, 'Card F'), {
    beforeDrop: () => page.keyboard.press('Escape'),
  });

  expect(await screenBoard(page)).toEqual(before);
  expect(fake.updates).toEqual([]);
});

test('coming back to the tab reloads the board only after saves finish', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);
  fake.options.writeDelayMs = 1500;
  fake.timeline.length = 0;

  await drag(page, card(page, 'Card C'), card(page, 'Card A'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => fake.timeline).toContain('load lists');

  expect(fake.timeline.indexOf('load lists')).toBeGreaterThan(fake.timeline.indexOf('update cards c done'));
  expect((await screenBoard(page))['List One']).toBe('CABD');
});

test('several moves in a row all survive a page reload', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await drag(page, card(page, 'Card D'), card(page, 'Card A'));
  await drag(page, card(page, 'Card B'), card(page, 'Card E'));
  await drag(page, card(page, 'Card G'), card(page, 'Card C'));
  await drag(page, card(page, 'Card F'), card(page, 'Card H'));
  const before = await screenBoard(page);

  await page.reload();
  await expect(page.getByText('List One')).toBeVisible();

  expect(await screenBoard(page)).toEqual(before);
  expect(databaseBoard(fake.db)).toEqual(before);
  const allCards = Object.values(before).join('');
  expect(allCards.length).toBe(10);
  expect(new Set(allCards).size).toBe(10);
});
