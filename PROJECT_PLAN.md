# My Trello Clone - Project Plan

## What We're Building
A personal Trello clone with resizable lists for organizing tasks at work and home.
See `README.md` for how it works and how to run it.

## Done
- [x] Lists: create, rename, resize, minimize, reorder by dragging, archive/unarchive
- [x] Cards: create, delete, tick off, reorder and move between lists by dragging
- [x] Card details window with auto-saving description
- [x] Work and Personal boards, each with an archive; move lists between boards; shared lists
- [x] Search across both boards and archives, with highlighting
- [x] Google sign-in, with each user's data kept private
- [x] Mobile support (touch drag, home screen app)
- [x] Reliable saving: one save per drag, saves in order, errors shown on screen (Nov 2026)
- [x] Code split into hooks and components, automated tests (`npm test`), up-to-date docs (Nov 2026)

## Known Limitations
- **Shared lists have one position for both boards.** They can't be ordered differently on Work and Personal.
- **Dragging during a search** works, but it places things relative to lists from both boards.
- **No live sync between devices.** The board reloads when you switch back to the tab, but not while you're looking at it.
- **`app/components/List.tsx` is long** (about 560 lines), mostly inline icon drawings. It could be split up.

## Ideas for Later
- [ ] Separate ordering of shared lists per board
- [ ] Live updates between devices (Supabase Realtime)
- [ ] Keyboard shortcuts (new card, new list, move between cards)
- [ ] Permanently delete archived lists
- [ ] Due dates or labels on cards

## How We Work Together
1. **One small chunk at a time.** Each chunk gets tested and committed before the next one.
2. **Run `npm test` before pushing.** It checks drag and drop and saving automatically.
3. **Database changes first.** If a change needs new database columns, run the SQL in Supabase before pushing the code (see "Database" in `README.md`).
4. **Push when something works.** Vercel deploys automatically from GitHub.

**Quick commands:**
```bash
npm test
git add .
git commit -m "Your message here"
git push
```
