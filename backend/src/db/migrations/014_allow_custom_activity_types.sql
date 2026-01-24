-- Migration: 014_allow_custom_activity_types
-- Description: Update activities type constraint to allow custom categories (custom:uuid format)
-- Related: 010_user_categories

-- Drop the existing constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS valid_activity_type;

-- Add updated constraint that allows:
-- 1. All default activity types
-- 2. Custom category references with format: custom:<uuid>
ALTER TABLE activities ADD CONSTRAINT valid_activity_type CHECK (
    type IN (
        -- Culture & History
        'museum', 'monument', 'historicSite', 'temple', 'church',
        -- Nature & Outdoors
        'park', 'beach', 'garden', 'hiking', 'viewpoint',
        -- Entertainment
        'themePark', 'zoo', 'aquarium', 'show', 'nightlife',
        -- Food & Drink
        'restaurant', 'cafe', 'market', 'winery',
        -- Shopping & Leisure
        'shopping', 'spa',
        -- Tours & Activities
        'tour', 'sightseeing', 'sports', 'watersports',
        -- Lodging (reservation types used in itinerary)
        'hotel', 'rental', 'hostel', 'camping', 'resort',
        -- Transport (reservation types used in itinerary)
        'flight', 'train', 'bus', 'car', 'ferry', 'cruise', 'taxi', 'transfer',
        -- Dining (reservation types)
        'bar',
        -- Legacy types (for backward compatibility)
        'accommodation', 'transportation', 'attraction', 'meeting', 'event', 'other'
    )
    OR type ~ '^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

COMMENT ON CONSTRAINT valid_activity_type ON activities IS 'Allows default types or custom category references (custom:uuid format)';

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('014_allow_custom_activity_types')
ON CONFLICT (version) DO NOTHING;
