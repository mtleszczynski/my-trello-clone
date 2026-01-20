-- Migration to add shared column to lists table
-- Run this in your Supabase SQL Editor

-- Add shared column with default false
ALTER TABLE lists ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_lists_shared ON lists(shared);
