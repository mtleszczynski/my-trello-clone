import { expect, type Locator, type Page } from '@playwright/test';
import type { FakeDatabase } from './fake-supabase';

// What's on screen: list titles in order, each with its card letters top to bottom (e.g. "ABCD")
export async function screenBoard(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('main [data-testid="list"]')].map((list) => [
        list.querySelector('span[title="Click to rename"]')?.textContent ?? '',
        [...list.querySelectorAll('[data-testid="card-title"]')]
          .map((title) => ({ text: title.textContent ?? '', top: title.getBoundingClientRect().top }))
          .sort((a, b) => a.top - b.top)
          .map((title) => title.text.replace('Card ', ''))
          .join(''),
      ])
    )
  );
}

// What's in the fake database, in the same format as screenBoard
export function databaseBoard(db: FakeDatabase, board = 'work'): Record<string, string> {
  const byPosition = (a: Record<string, unknown>, b: Record<string, unknown>) => (a.position as number) - (b.position as number);
  return Object.fromEntries(
    db.lists
      .filter((list) => list.board === board && !list.archived)
      .sort(byPosition)
      .map((list) => [
        list.title as string,
        db.cards.filter((c) => c.list_id === list.id).sort(byPosition).map((c) => c.id.toUpperCase()).join(''),
      ])
  );
}

export function card(page: Page, title: string): Locator {
  return page.getByTestId('card-title').filter({ hasText: new RegExp(`^${title}$`) });
}

export function listHandle(page: Page, title: string): Locator {
  return page.getByTestId('list').filter({ hasText: title }).getByTitle('Drag to reorder');
}

export async function openBoard(page: Page) {
  await page.goto('/');
  await expect(page.getByText('List One')).toBeVisible();
}

// Drag one thing onto another with the mouse. `beforeDrop` runs while still holding the mouse button.
export async function drag(
  page: Page,
  from: Locator,
  to: Locator,
  { offsetY = 0, beforeDrop }: { offsetY?: number; beforeDrop?: () => Promise<void> } = {}
) {
  await page.evaluate(() => document.querySelector('main')!.scrollTo({ left: 0 }));
  const fromBox = (await from.boundingBox())!;
  const toBox = (await to.boundingBox())!;
  const startX = fromBox.x + fromBox.width / 2;
  const startY = fromBox.y + fromBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2 + offsetY, { steps: 25 });
  await page.waitForTimeout(300);
  if (beforeDrop) await beforeDrop();
  await page.mouse.up();
  await page.waitForTimeout(500);
}
