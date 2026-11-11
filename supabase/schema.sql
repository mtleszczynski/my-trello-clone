-- Complete database setup for My Trello Clone (matches the live database).
--
-- For a NEW Supabase project: paste this whole file into the Supabase SQL Editor and click Run.
-- For the EXISTING project: don't run this. Changes go in supabase/migrations/ instead (see README).

-- Lists (the columns on a board)
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- Order on the board. Fractional values (e.g. 2.5) are normal: a moved list goes between its neighbours
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 300,
  -- 'work' or 'personal'
  board TEXT NOT NULL DEFAULT 'work',
  -- Shown on both boards
  shared BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  -- Collapsed to a narrow strip
  minimized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cards (the items inside a list)
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  -- Order within the list (fractional, like lists.position)
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_lists_position ON lists(position);
CREATE INDEX idx_lists_archived ON lists(archived);
CREATE INDEX idx_lists_board ON lists(board);
CREATE INDEX idx_lists_shared ON lists(shared);
CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_cards_list_id ON cards(list_id);
CREATE INDEX idx_cards_position ON cards(position);

-- Row Level Security: each signed-in user can only see and change their own lists and cards
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lists" ON lists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own lists" ON lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own lists" ON lists
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own lists" ON lists
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own cards" ON cards
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own cards" ON cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cards" ON cards
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cards" ON cards
  FOR DELETE USING (auth.uid() = user_id);
