-- OpenTripBoard Account Lockout Migration
-- Version: 012
-- Description: Add account lockout fields to users table for brute force protection

-- Add failed login attempts counter
ALTER TABLE users
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;

-- Add lockout expiration timestamp
ALTER TABLE users
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Add last failed login timestamp for tracking
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP WITH TIME ZONE;

-- Create index for lockout queries (checking if account is locked)
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- Create index for failed login attempts tracking
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts) WHERE failed_login_attempts > 0;

-- Comments for documentation
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for consecutive failed login attempts. Resets to 0 on successful login.';
COMMENT ON COLUMN users.locked_until IS 'Account is locked until this timestamp. NULL means account is not locked.';
COMMENT ON COLUMN users.last_failed_login_at IS 'Timestamp of the most recent failed login attempt for audit purposes.';

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('012_add_account_lockout')
ON CONFLICT (version) DO NOTHING;
