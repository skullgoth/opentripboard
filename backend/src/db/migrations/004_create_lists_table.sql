-- Migration: Create lists table for packing lists and custom lists
-- User Story 6: Packing and Custom Lists

-- Create lists table
CREATE TABLE IF NOT EXISTS lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_list_type CHECK (type IN ('packing', 'todo', 'shopping', 'custom')),
    CONSTRAINT valid_items_array CHECK (jsonb_typeof(items) = 'array'),
    CONSTRAINT title_not_empty CHECK (char_length(title) >= 1)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lists_trip_id ON lists(trip_id);
CREATE INDEX IF NOT EXISTS idx_lists_items ON lists USING GIN(items);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lists_updated_at ON lists;
CREATE TRIGGER trigger_lists_updated_at
    BEFORE UPDATE ON lists
    FOR EACH ROW
    EXECUTE FUNCTION update_lists_updated_at();

COMMENT ON TABLE lists IS 'Packing lists, to-do lists, and custom lists for trips';
COMMENT ON COLUMN lists.type IS 'List type: packing, todo, shopping, custom';
COMMENT ON COLUMN lists.items IS 'JSONB array of items with id, text, checked, order fields';

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('004_create_lists_table')
ON CONFLICT (version) DO NOTHING;
