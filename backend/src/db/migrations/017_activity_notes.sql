-- Migration: 017_activity_notes
-- Description: Create activity_notes table for text notes attached to activities

CREATE TABLE IF NOT EXISTS activity_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL CHECK (char_length(content) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_notes_activity_id ON activity_notes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_notes_trip_id ON activity_notes(trip_id);

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('017_activity_notes')
ON CONFLICT (version) DO NOTHING;
