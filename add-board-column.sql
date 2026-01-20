-- Migration to add board column to lists table
-- Run this in your Supabase SQL Editor

-- Add board column with default 'work'
ALTER TABLE lists ADD COLUMN IF NOT EXISTS board TEXT NOT NULL DEFAULT 'work';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board);

-- Update existing lists to be 'work' board (they should already have this due to default)
UPDATE lists SET board = 'work' WHERE board IS NULL;
