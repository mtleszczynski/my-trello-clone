# My Trello Clone - Project Plan

## What We're Building
A personal Trello clone with resizable lists for organizing tasks at work and home.

## What's Already Done
- [x] Project setup (Next.js, TypeScript, Tailwind)
- [x] Supabase client configured
- [x] @dnd-kit installed for drag and drop
- [x] GitHub repository set up (with SSH keys for personal account)
- [x] Vercel deployment working
- [x] Database schema file created
- [x] Phase 1: Database tables created in Supabase
- [x] Phase 2: Display lists from database
- [x] Phase 3: Create new lists
- [x] Phase 4: Display cards in lists
- [x] Phase 5: Create new cards
- [x] Phase 6: Delete cards and lists
- [x] Phase 7: Drag and drop cards within lists
- [x] Phase 8: Drag and drop cards between lists (with real-time preview)
- [x] Phase 9: Drag and drop to reorder lists

## What's Left To Do

---

### Phase 1: Database Setup
**Goal:** Get the database tables created in Supabase

- [ ] **Step 1.1:** Run the database schema in Supabase SQL Editor
  - Open Supabase dashboard
  - Go to SQL Editor
  - Copy contents of `database-schema.sql`
  - Run the SQL

---

### Phase 2: Display Lists
**Goal:** Show lists from the database on the page

- [ ] **Step 2.1:** Create a basic Board component that fetches lists from Supabase
- [ ] **Step 2.2:** Create a List component that displays a single list
- [ ] **Step 2.3:** Style the lists to look like Trello columns
- [ ] **Step 2.4:** Test that lists display correctly
- [ ] **Step 2.5:** Commit and push to GitHub

---

### Phase 3: Create Lists
**Goal:** Add new lists with custom names

- [ ] **Step 3.1:** Add an "Add List" button to the board
- [ ] **Step 3.2:** Create input field for list name
- [ ] **Step 3.3:** Save new list to Supabase
- [ ] **Step 3.4:** Update UI to show new list
- [ ] **Step 3.5:** Test creating multiple lists
- [ ] **Step 3.6:** Commit and push to GitHub

---

### Phase 4: Display Cards
**Goal:** Show cards/items inside each list

- [ ] **Step 4.1:** Update database query to include cards
- [ ] **Step 4.2:** Create a Card component
- [ ] **Step 4.3:** Display cards inside their lists
- [ ] **Step 4.4:** Style cards to look nice
- [ ] **Step 4.5:** Test that cards display correctly
- [ ] **Step 4.6:** Commit and push to GitHub

---

### Phase 5: Create Cards
**Goal:** Add new cards to lists

- [ ] **Step 5.1:** Add an "Add Card" button to each list
- [ ] **Step 5.2:** Create input field for card title
- [ ] **Step 5.3:** Save new card to Supabase
- [ ] **Step 5.4:** Update UI to show new card
- [ ] **Step 5.5:** Test creating cards in different lists
- [ ] **Step 5.6:** Commit and push to GitHub

---

### Phase 6: Delete Cards and Lists
**Goal:** Remove cards and lists

- [ ] **Step 6.1:** Add delete button to cards
- [ ] **Step 6.2:** Implement card deletion (Supabase + UI)
- [ ] **Step 6.3:** Add delete button to lists
- [ ] **Step 6.4:** Implement list deletion (deletes cards too)
- [ ] **Step 6.5:** Add confirmation before deleting lists
- [ ] **Step 6.6:** Test deletion
- [ ] **Step 6.7:** Commit and push to GitHub

---

### Phase 7: Drag and Drop Cards (Within List)
**Goal:** Reorder cards by dragging within the same list

- [ ] **Step 7.1:** Set up @dnd-kit context
- [ ] **Step 7.2:** Make cards draggable
- [ ] **Step 7.3:** Make lists droppable
- [ ] **Step 7.4:** Update card positions on drop
- [ ] **Step 7.5:** Save new positions to Supabase
- [ ] **Step 7.6:** Test reordering cards
- [ ] **Step 7.7:** Commit and push to GitHub

---

### Phase 8: Drag and Drop Cards (Between Lists)
**Goal:** Move cards between lists by dragging

- [ ] **Step 8.1:** Enable dropping cards in different lists
- [ ] **Step 8.2:** Update card's list_id when moved
- [ ] **Step 8.3:** Update positions in both source and destination lists
- [ ] **Step 8.4:** Save changes to Supabase
- [ ] **Step 8.5:** Test moving cards between lists
- [ ] **Step 8.6:** Commit and push to GitHub

---

### Phase 9: Drag and Drop Lists
**Goal:** Reorder lists by dragging

- [ ] **Step 9.1:** Make lists draggable
- [ ] **Step 9.2:** Make board droppable for lists
- [ ] **Step 9.3:** Update list positions on drop
- [ ] **Step 9.4:** Save new positions to Supabase
- [ ] **Step 9.5:** Test reordering lists
- [ ] **Step 9.6:** Commit and push to GitHub

---

### Phase 10: Resize List Widths
**Goal:** Drag to resize list widths (the main feature you wanted!)

- [ ] **Step 10.1:** Add resize handle to list edges
- [ ] **Step 10.2:** Implement drag-to-resize functionality
- [ ] **Step 10.3:** Set minimum and maximum widths
- [ ] **Step 10.4:** Save width to Supabase
- [ ] **Step 10.5:** Load saved widths on page load
- [ ] **Step 10.6:** Test resizing lists
- [ ] **Step 10.7:** Commit and push to GitHub

---

### Phase 11: Card Details Modal
**Goal:** Click a card to open it and add text details

- [ ] **Step 11.1:** Create a modal/dialog component
- [ ] **Step 11.2:** Open modal when clicking a card
- [ ] **Step 11.3:** Display card title in modal
- [ ] **Step 11.4:** Add text area for description
- [ ] **Step 11.5:** Save description to Supabase
- [ ] **Step 11.6:** Close modal and update card
- [ ] **Step 11.7:** Test adding details to cards
- [ ] **Step 11.8:** Commit and push to GitHub

---

### Phase 12: Mark Cards as Completed
**Goal:** Check off completed tasks

- [ ] **Step 12.1:** Add checkbox to cards
- [ ] **Step 12.2:** Toggle completed state on click
- [ ] **Step 12.3:** Style completed cards (strikethrough, faded)
- [ ] **Step 12.4:** Save completed state to Supabase
- [ ] **Step 12.5:** Test marking cards complete/incomplete
- [ ] **Step 12.6:** Commit and push to GitHub

---

### Phase 13: Archive Lists
**Goal:** Move lists to an archive (hide but don't delete)

- [ ] **Step 13.1:** Add archive button to lists
- [ ] **Step 13.2:** Set archived flag in Supabase
- [ ] **Step 13.3:** Hide archived lists from main board
- [ ] **Step 13.4:** Create "View Archive" section
- [ ] **Step 13.5:** Allow restoring lists from archive
- [ ] **Step 13.6:** Test archiving and restoring
- [ ] **Step 13.7:** Commit and push to GitHub

---

### Phase 14: Search
**Goal:** Find lists and cards quickly

- [ ] **Step 14.1:** Add search input to the top of the board
- [ ] **Step 14.2:** Filter lists by title as you type
- [ ] **Step 14.3:** Filter cards by title as you type
- [ ] **Step 14.4:** Highlight matching text
- [ ] **Step 14.5:** Test search functionality
- [ ] **Step 14.6:** Commit and push to GitHub

---

### Phase 15: Polish and Improvements
**Goal:** Make everything look and feel great

- [ ] **Step 15.1:** Improve overall styling
- [ ] **Step 15.2:** Add loading states
- [ ] **Step 15.3:** Add error messages for failed operations
- [ ] **Step 15.4:** Test on mobile devices
- [ ] **Step 15.5:** Final testing of all features
- [ ] **Step 15.6:** Final commit and push

---

## Current File Structure
```
app/
  components/
    Card.tsx           - Single card display
    List.tsx           - Single list with cards, drag handle, delete button
    SortableCard.tsx   - Draggable card wrapper
    SortableList.tsx   - Draggable list wrapper
  lib/
    supabase.ts        - Supabase client
  types/
    index.ts           - TypeScript interfaces (Card, List)
  page.tsx             - Main board with DndContext, all handlers
  layout.tsx           - App layout
  globals.css          - Global styles
```

## How We'll Work Together

1. **One phase at a time** - We'll complete each phase before moving to the next
2. **One step at a time** - I'll guide you through each step with simple instructions
3. **Test as we go** - We'll test each feature before moving on
4. **Commit often** - We'll save progress to GitHub regularly
5. **I'll remind you to push** - I'll tell you when it's a good time to push to GitHub
6. **Ask questions** - If anything is unclear, just ask

## When to Push to GitHub

I'll remind you, but here's when it's a good time to push:

- **After adding important files** - Like config files or documentation
- **After completing a feature** - When something new works
- **Before making risky changes** - So you can go back if something breaks
- **At the end of a work session** - Before you close your laptop
- **After fixing a bug** - Save the fix so you don't lose it

**Quick commands:**
```bash
git add .
git commit -m "Your message here"
git push
```

## Ready to Start?

Let's begin with **Phase 1: Database Setup** - running the database schema in Supabase.
