-- Fix User Preferences Default Migration
-- Version: 008
-- Description: Change preferences default to NULL so we can detect first-time users

-- Change the default to NULL for new users
ALTER TABLE users ALTER COLUMN preferences DROP DEFAULT;
ALTER TABLE users ALTER COLUMN preferences SET DEFAULT NULL;

-- Reset existing users who have never explicitly changed preferences
-- (they have the exact default English values) to NULL
-- This allows browser locale detection on next login
UPDATE users
SET preferences = NULL
WHERE preferences = '{"language": "en", "dateFormat": "mdy", "timeFormat": "12h", "distanceFormat": "mi"}'::jsonb
  OR preferences = '{"dateFormat": "mdy", "distanceFormat": "mi", "language": "en", "timeFormat": "12h"}'::jsonb;

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('008_fix_preferences_default')
ON CONFLICT (version) DO NOTHING;
