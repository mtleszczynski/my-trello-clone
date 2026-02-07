-- Add minimized column to lists table
-- This allows users to collapse a list to a narrow view showing only checkboxes
ALTER TABLE lists ADD COLUMN minimized BOOLEAN NOT NULL DEFAULT false;
