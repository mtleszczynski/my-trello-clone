# My Trello Clone

A personal kanban board, like Trello but simpler, with one key extra: **you can resize list widths**.

Live site: [my-trello-clone-sable.vercel.app](https://my-trello-clone-sable.vercel.app)

## Features

- **Two boards**, Work and Personal, each with its own archive
- **Lists**: add, rename, resize, minimize to a narrow strip, drag to reorder, archive/unarchive, move to the other board, or share so a list shows on both boards
- **Cards**: add, delete, tick off as done, drag to reorder or move between lists, open to edit the title and a longer description (saves automatically)
- **Search** across both boards and archives, with matches highlighted
- **Sign in with Google**; each person only sees their own data
- Works on phones (touch drag, can be added to the home screen)

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) for styling
- [Supabase](https://supabase.com) for the database and Google login
- [@dnd-kit](https://dndkit.com) for drag and drop
- [Playwright](https://playwright.dev) for automated tests
- Hosted on [Vercel](https://vercel.com), which deploys automatically on every push to `main`

## Running it on your computer

1. Install [Node.js](https://nodejs.org) (version 20 or newer).
2. Install the project's packages:
   ```bash
   npm install
   ```
3. Copy `.env.example` to a new file called `.env.local` and fill in your Supabase details
   (Supabase dashboard → your project → **Project Settings** → **API**).
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open [localhost:3000](http://localhost:3000).

**Demo mode:** with `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` in `.env.local`, the app skips login and shows built-in
demo data. Nothing is saved, so it's safe for trying out changes. Set it to `false` to use your real data
(you'll need to sign in with Google).

## Tests

```bash
npm test
```

This builds the app and runs the automated tests in Google Chrome (it must be installed). They cover drag and
drop, saving, failed saves, archiving, search and more. The tests use a fake, in-memory Supabase
(`tests/fake-supabase.ts`), so they never touch real data and don't need a login. Run them before pushing.

## Database

- `supabase/schema.sql` is the **complete, current** database setup. To set up a brand-new Supabase project,
  paste it into the Supabase **SQL Editor** and click **Run**.
- `supabase/migrations/` holds every change made to the live database, oldest first. When the database needs to
  change:
  1. Add a new file there, named with today's date (e.g. `20261201_add_due_dates.sql`).
  2. Make the same change in `supabase/schema.sql`, so it stays complete.
  3. Run the new file in the Supabase SQL Editor **before** pushing app code that depends on it.

Tables:

| Table | Columns |
|-------|---------|
| `lists` | `id`, `user_id`, `title`, `position`, `width`, `board` (`work`/`personal`), `shared`, `archived`, `minimized`, `created_at` |
| `cards` | `id`, `user_id`, `list_id`, `title`, `description`, `position`, `completed`, `created_at` |

Row Level Security makes sure each user can only read and change their own rows.

## How the code is organised

```
app/
  page.tsx                  Main page: puts the header, board and card details together
  hooks/
    useBoard.ts             Loads the board and saves every change
    useBoardDragAndDrop.ts  Dragging cards and lists
    useDragToScroll.ts      Drag the empty background to scroll sideways
  components/               UI pieces (List, Card, Header, CardDetailsModal, ...)
  lib/
    supabase.ts             Supabase client
    positions.ts            Ordering maths for cards and lists (see below)
    board.ts                Small helpers for finding lists and cards
    sampleData.ts           Sample lists for new users, and demo-mode data
  types/index.ts            TypeScript types (List, Card, ...)
supabase/                   Database setup and change history
tests/                      Automated tests
```

### How saving works

- **Changes show up instantly, then save in the background.** Saves run one at a time, in order, so a later change
  can never be overwritten by an earlier one. If a save fails, a red message appears with a "Reload board" button.
- **Ordering uses fractional positions.** When you drag a card between two cards at positions 2 and 3, it gets
  position 2.5. Only the moved card is saved, which is fast and can't leave a list half-reordered. If two neighbours
  ever share the same position, that list is renumbered 0, 1, 2, ... automatically.
- **The board reloads when you come back to the tab**, so changes made on another device show up. It waits for any
  of your own pending saves first.

## Deploying

Push to `main` on GitHub; Vercel builds and deploys automatically. The Vercel project needs the same
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` settings as `.env.local` (Vercel → project →
**Settings** → **Environment Variables**). Don't set `NEXT_PUBLIC_DEV_BYPASS_AUTH` there.
