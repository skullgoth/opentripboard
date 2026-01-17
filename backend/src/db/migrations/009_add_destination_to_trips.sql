-- Migration: Add destination metadata and cover image attribution to trips
-- Feature: 003-destination-autocomplete-cover
-- Date: 2026-01-10

-- Add destination metadata column (OpenStreetMap Nominatim data)
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS destination_data JSONB;

-- Add cover image attribution column (Pexels photographer credits)
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS cover_image_attribution JSONB;

-- Indexes for efficient queries

-- Index for querying by place_id (find all trips to specific location)
CREATE INDEX IF NOT EXISTS idx_trips_destination_place_id
ON trips ((destination_data->>'place_id'));

-- Index for querying by country (find all trips to specific country)
CREATE INDEX IF NOT EXISTS idx_trips_destination_country
ON trips ((destination_data->'address'->>'country'));

-- Index for querying validated vs manual destinations
CREATE INDEX IF NOT EXISTS idx_trips_destination_validated
ON trips ((destination_data->>'validated'));

-- Add comments for documentation
COMMENT ON COLUMN trips.destination_data IS
'Structured destination metadata from OpenStreetMap Nominatim. NULL for trips created before this feature or during API outage. Format: {place_id, display_name, lat, lon, type, address, validated}';

COMMENT ON COLUMN trips.cover_image_attribution IS
'Photo credit information for cover images. Format: {source: "pexels"|"user_upload"|"placeholder", photographer, photographer_url, photo_id, photo_url}. NULL for user-uploaded or placeholder covers without attribution.';
