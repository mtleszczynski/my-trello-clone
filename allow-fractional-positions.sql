-- Migration to allow fractional positions (e.g. 2.5) for lists and cards
-- Run this in your Supabase SQL Editor BEFORE deploying the matching app code
--
-- When a card or list is dragged, the app gives it a position halfway between its new
-- neighbours, so only that one row has to be saved instead of renumbering the whole list.
-- Existing whole-number positions stay exactly as they are.

ALTER TABLE lists ALTER COLUMN position TYPE double precision;
ALTER TABLE cards ALTER COLUMN position TYPE double precision;
