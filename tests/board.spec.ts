import { test, expect } from '@playwright/test';
import { sampleBoard, useFakeSupabase } from './fake-supabase';
import { openBoard, screenBoard } from './helpers';

test('tabs switch between boards and archives', async ({ page, baseURL }) => {
  const db = sampleBoard();
  db.lists[2].board = 'personal';
  db.lists[1].archived = true;
  await useFakeSupabase(page, baseURL!, db);
  await openBoard(page);

  expect(Object.keys(await screenBoard(page))).toEqual(['List One']);
  await page.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect.poll(async () => Object.keys(await screenBoard(page))).toEqual(['List Three']);
  await page.getByRole('button', { name: 'Work Archive' }).click();
  await expect.poll(async () => Object.keys(await screenBoard(page))).toEqual(['List Two']);
  await expect(page.getByText('+ Add a list')).toBeHidden();
});

test('archiving and unarchiving a list', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);
  page.on('dialog', (dialog) => dialog.accept());

  await page.getByTestId('list').filter({ hasText: 'List Two' }).getByTitle('Archive list').click();
  await expect(page.getByText('List Two')).toBeHidden();
  await expect.poll(() => fake.db.lists.find((l) => l.id === 'L2')!.archived).toBe(true);

  await page.getByRole('button', { name: 'Work Archive' }).click();
  await page.getByTestId('list').filter({ hasText: 'List Two' }).getByTitle('Unarchive list').click();
  await expect(page.getByText('List Two')).toBeHidden();
  await expect.poll(() => fake.db.lists.find((l) => l.id === 'L2')!.archived).toBe(false);
});

test('adding a list', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await page.getByText('+ Add a list').click();
  await page.getByPlaceholder('Enter list title...').fill('List Four');
  await page.getByRole('button', { name: 'Add list' }).click();

  await expect(page.getByText('List Four')).toBeVisible();
  await expect(page.getByText('+ Add a list')).toBeVisible();
  expect(fake.db.lists.find((l) => l.title === 'List Four')).toMatchObject({ position: 3, board: 'work' });
});

test('renaming and minimizing a list', async ({ page, baseURL }) => {
  const fake = await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  await page.getByTitle('Click to rename').filter({ hasText: 'List One' }).click();
  const titleInput = page.getByRole('textbox', { name: '' }).and(page.locator('main input'));
  await titleInput.fill('First List');
  await titleInput.press('Enter');
  await expect(page.getByText('First List')).toBeVisible();
  await expect.poll(() => fake.db.lists.find((l) => l.id === 'L1')!.title).toBe('First List');

  await page.getByTestId('list').filter({ hasText: 'List Two' }).getByTitle('Minimize list').click();
  await expect(page.getByTitle('Expand list')).toBeVisible();
  await expect.poll(() => fake.db.lists.find((l) => l.id === 'L2')!.minimized).toBe(true);
});

test('search shows lists from every board and highlights matches', async ({ page, baseURL }) => {
  const db = sampleBoard();
  db.lists[2].board = 'personal';
  await useFakeSupabase(page, baseURL!, db);
  await openBoard(page);

  await page.getByPlaceholder('Search...').fill('Card H');

  await expect(page.locator('mark', { hasText: 'Card H' })).toBeVisible();
  await expect(page.getByText('List Three')).toBeVisible();
  await expect(page.getByText('Pers', { exact: true })).toBeVisible();
});

test('dragging the empty board background scrolls it sideways', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 600, height: 700 });
  await useFakeSupabase(page, baseURL!);
  await openBoard(page);

  const main = page.locator('main');
  const box = (await main.boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + box.height - 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + box.height - 40, { steps: 10 });
  await page.mouse.up();

  expect(await main.evaluate((el) => el.scrollLeft)).toBeGreaterThan(150);
});
