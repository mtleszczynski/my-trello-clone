import { test, expect } from '@playwright/test';
import { sampleBoard, useFakeSupabase } from './fake-supabase';
import { card, databaseBoard, drag, openBoard, screenBoard } from './helpers';

test('a failed save shows a message, and reloading shows what was really saved', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);
  fake.options.failWrites = true;

  await drag(page, card(page, 'Card D'), card(page, 'Card A'));
  await expect(page.getByText("Something went wrong moving the card. It wasn't saved.")).toBeVisible();

  fake.options.failWrites = false;
  await page.getByText('Reload board').click();
  await expect.poll(async () => (await screenBoard(page))['List One']).toBe('ABCD');
  expect(databaseBoard(fake.db)['List One']).toBe('ABCD');
});

test('card details only say Saved once the save worked', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await card(page, 'Card E').click();
  const title = page.getByPlaceholder('Enter card title...');
  await title.fill('Card E edited');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 5000 });
  expect(fake.db.cards.find((c) => c.id === 'e')!.title).toBe('Card E edited');

  fake.options.failWrites = true;
  await title.fill('Card E edited again');
  await expect(page.getByText('Not saved', { exact: true })).toBeVisible({ timeout: 5000 });
});

test('a failed checkbox shows a message', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);
  fake.options.failWrites = true;

  await page.getByTestId('card').filter({ hasText: 'Card G' }).getByTitle('Mark complete').click();

  await expect(page.getByText("Something went wrong ticking off the card. It wasn't saved.")).toBeVisible();
});

test('new cards go after the highest position', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  // List Three has 4 cards but its highest position is 1
  const listThree = page.getByTestId('list').filter({ hasText: 'List Three' });
  await listThree.getByText('+ Add a card').click();
  await listThree.getByPlaceholder('Enter a title for this card...').fill('Card K');
  await listThree.getByPlaceholder('Enter a title for this card...').press('Enter');

  await expect(card(page, 'Card K')).toBeVisible();
  expect(fake.db.cards.find((c) => c.title === 'Card K')!.position).toBe(2);
});

test('an empty Work board does not get sample lists if you have lists elsewhere', async ({ page, baseURL }) => {
  const db = sampleBoard();
  for (const list of db.lists) list.board = 'personal';
  const fake = await useFakeSupabase(page, baseURL!, db);

  await page.goto('/');
  await expect(page.getByText('+ Add a list')).toBeVisible();
  await page.waitForTimeout(500);

  expect(fake.inserts).toEqual([]);
  expect(await screenBoard(page)).toEqual({});
});

test('a brand-new user gets sample lists', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!, { lists: [], cards: [] });

  await page.goto('/');

  await expect(page.getByText('📋 To Do')).toBeVisible();
  expect(fake.inserts).toEqual(['lists', 'cards']);
});
