-- Migration: Update valid activity types
-- This migration updates the valid activity types to include all new types:
-- Lodging: hotel, rental
-- Transport: bus, car, cruise, ferry, flight, train
-- Dining: bar, restaurant
-- Activities: market, monument, museum, park, shopping, sightseeing
-- Legacy types (for backward compatibility): accommodation, transportation, attraction, meeting, event, other

-- Drop the existing constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS valid_activity_type;

-- Add the updated constraint with all types included
ALTER TABLE activities ADD CONSTRAINT valid_activity_type CHECK (type IN (
    -- Lodging
    'hotel', 'rental',
    -- Transport
    'bus', 'car', 'cruise', 'ferry', 'flight', 'train',
    -- Dining
    'bar', 'restaurant',
    -- Activities
    'market', 'monument', 'museum', 'park', 'shopping', 'sightseeing',
    -- Legacy types (for backward compatibility)
    'accommodation', 'transportation', 'attraction', 'meeting', 'event', 'other'
));

COMMENT ON TABLE activities IS 'Activities table with expanded type support added in migration 002';

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('002_add_train_activity_type')
ON CONFLICT (version) DO NOTHING;
