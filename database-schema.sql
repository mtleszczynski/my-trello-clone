-- Fresh database schema for Trello Clone
-- Run this in your Supabase SQL Editor after dropping existing tables

-- Drop existing tables if they exist (run this first if needed)
-- DROP TABLE IF EXISTS cards CASCADE;
-- DROP TABLE IF EXISTS lists CASCADE;

-- Create lists table
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 300,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cards table
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_lists_position ON lists(position);
CREATE INDEX idx_cards_list_id ON cards(list_id);
CREATE INDEX idx_cards_position ON cards(position);

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your auth needs)
-- For now, allowing all operations for authenticated and anonymous users
CREATE POLICY "Allow all operations on lists" ON lists
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on cards" ON cards
  FOR ALL USING (true) WITH CHECK (true);
