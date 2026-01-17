-- User Preferences Migration
-- Version: 002
-- Description: Add user preferences JSONB column for internationalization settings

-- Add preferences column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
  "language": "en",
  "dateFormat": "mdy",
  "timeFormat": "12h",
  "distanceFormat": "mi"
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN users.preferences IS 'User display preferences: language (en/fr/es), dateFormat (mdy/dmy), timeFormat (12h/24h), distanceFormat (mi/km)';

-- Create index for preference queries (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_users_preferences_language
ON users USING GIN ((preferences->'language'));

-- Update schema_migrations
INSERT INTO schema_migrations (version) VALUES ('002_user_preferences')
ON CONFLICT (version) DO NOTHING;
