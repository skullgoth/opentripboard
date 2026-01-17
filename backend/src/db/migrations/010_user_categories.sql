-- Migration: 010_user_categories
-- Description: Create user_categories table for custom category types
-- Feature: 004-trip-categories

-- Create user_categories table
CREATE TABLE user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    domain VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_domain CHECK (domain IN ('activity', 'reservation', 'expense', 'document')),
    CONSTRAINT name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT icon_not_empty CHECK (LENGTH(TRIM(icon)) > 0)
);

-- Indexes for fast lookup
CREATE INDEX idx_user_categories_user_id ON user_categories(user_id);
CREATE INDEX idx_user_categories_user_domain ON user_categories(user_id, domain);

-- Trigger for updated_at (uses existing function from initial migration)
CREATE TRIGGER update_user_categories_updated_at
    BEFORE UPDATE ON user_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment for documentation
COMMENT ON TABLE user_categories IS 'User-defined custom categories for activities, reservations, expenses, and documents';
COMMENT ON COLUMN user_categories.domain IS 'Category domain: activity, reservation, expense, or document';
COMMENT ON COLUMN user_categories.icon IS 'Emoji character(s) for the category icon';
