-- Migration: 015_unify_category_domains
-- Description: Consolidate 'reservation' domain into 'activity' domain for unified category system
-- Feature: Unified Activity Categories Refactor

-- Step 1: Migrate existing reservation categories to activity domain
UPDATE user_categories SET domain = 'activity' WHERE domain = 'reservation';

-- Step 2: Drop old constraint and add new one without 'reservation'
ALTER TABLE user_categories DROP CONSTRAINT IF EXISTS valid_domain;
ALTER TABLE user_categories ADD CONSTRAINT valid_domain
  CHECK (domain IN ('activity', 'expense', 'document'));

-- Update table comment to reflect new domain structure
COMMENT ON COLUMN user_categories.domain IS 'Category domain: activity, expense, or document (reservation merged into activity)';

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('015_unify_category_domains')
ON CONFLICT (version) DO NOTHING;
