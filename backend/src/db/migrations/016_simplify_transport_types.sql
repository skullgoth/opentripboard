-- Migration: 016_simplify_transport_types
-- Description: Replace complex transport reservation types with simple transit stop types
-- Transport reservations (flight, train, bus, car, ferry, cruise, taxi, transfer) are now
-- simple transit stop activities (airport, train_station, bus_stop, etc.) with just a location.
-- The auto-calculated transport between activities handles route visualization.

-- Drop the existing constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS valid_activity_type;

-- Add updated constraint with:
-- 1. New transit stop types (airport, train_station, bus_stop, ferry_terminal, port, subway_station)
-- 2. Removed complex transport reservation types (but kept for backward compatibility)
-- 3. All other existing types preserved
ALTER TABLE activities ADD CONSTRAINT valid_activity_type CHECK (
    type IN (
        -- Culture & History
        'museum', 'monument', 'historicSite', 'temple', 'church',
        -- Nature & Outdoors
        'park', 'beach', 'garden', 'hiking', 'viewpoint',
        -- Entertainment
        'themePark', 'zoo', 'aquarium', 'show', 'nightlife', 'concert',
        -- Food & Drink
        'restaurant', 'cafe', 'market', 'winery',
        -- Shopping & Leisure
        'shopping', 'spa',
        -- Tours & Activities
        'tour', 'sightseeing', 'sports', 'watersports', 'class', 'attraction',
        -- Lodging (reservation types used in itinerary)
        'hotel', 'rental', 'hostel', 'camping', 'resort',
        -- Transport (transit stop types)
        'airport', 'train_station', 'bus_stop', 'ferry_terminal', 'port', 'subway_station',
        -- Dining (reservation types)
        'bar',
        -- Legacy types (for backward compatibility - includes old transport types)
        'accommodation', 'transportation', 'meeting', 'event', 'other',
        'flight', 'train', 'bus', 'car', 'ferry', 'cruise', 'taxi', 'transfer', 'transit'
    )
    OR type ~ '^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

COMMENT ON CONSTRAINT valid_activity_type ON activities IS 'Allows default types (including new transit stops) or custom category references. Legacy transport types kept for backward compatibility.';

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('016_simplify_transport_types')
ON CONFLICT (version) DO NOTHING;
