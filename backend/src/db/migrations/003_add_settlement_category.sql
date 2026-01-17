-- Migration: Add 'settlement' category to expenses table
-- This allows tracking settlement payments between trip participants

-- Drop the existing constraint and add a new one with 'settlement' included
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS valid_category;
ALTER TABLE expenses ADD CONSTRAINT valid_category CHECK (category IN (
    'accommodation', 'transportation', 'food', 'activities',
    'shopping', 'entertainment', 'settlement', 'other'
));
