-- Migration to add user authentication to Trello Clone
-- Run this in your Supabase SQL Editor

-- Step 1: Add user_id column to lists table
ALTER TABLE lists ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Add user_id column to cards table  
ALTER TABLE cards ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Create indexes for better query performance
CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_cards_user_id ON cards(user_id);

-- Step 4: Drop old permissive policies
DROP POLICY IF EXISTS "Allow all operations on lists" ON lists;
DROP POLICY IF EXISTS "Allow all operations on cards" ON cards;

-- Step 5: Create new RLS policies that restrict data by user

-- Lists policies: users can only see/modify their own lists
CREATE POLICY "Users can view their own lists" ON lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lists" ON lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists" ON lists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists" ON lists
  FOR DELETE USING (auth.uid() = user_id);

-- Cards policies: users can only see/modify their own cards
CREATE POLICY "Users can view their own cards" ON cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cards" ON cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" ON cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON cards
  FOR DELETE USING (auth.uid() = user_id);

-- NOTE: After running this migration, any existing lists/cards will have NULL user_id
-- and won't be visible to anyone. If you have existing data you want to keep,
-- you'll need to update them with your user_id after signing in:
--
-- UPDATE lists SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
-- UPDATE cards SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
--
-- You can find your user_id in Supabase Dashboard > Authentication > Users
