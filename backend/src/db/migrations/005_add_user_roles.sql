-- OpenTripBoard User Roles Migration
-- Version: 005
-- Description: Add role column to users table for RBAC

-- Create enum type for user roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table with default 'user'
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Comment for documentation
COMMENT ON COLUMN users.role IS 'User role for RBAC: user (default) or admin';

-- Register migration
INSERT INTO schema_migrations (version) VALUES ('005_add_user_roles')
ON CONFLICT (version) DO NOTHING;
