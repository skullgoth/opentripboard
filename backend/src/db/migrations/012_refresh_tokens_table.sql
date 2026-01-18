-- OpenTripBoard Refresh Tokens Migration
-- Version: 012
-- Description: Create refresh_tokens table for token rotation and revocation

-- Create refresh_tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    family_id UUID NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_token_hash UNIQUE (token_hash)
);

-- Create indexes for performance
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Comments for documentation
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for authentication with rotation and revocation support';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token for secure storage';
COMMENT ON COLUMN refresh_tokens.family_id IS 'Token family ID for tracking rotation chains and detecting reuse';
COMMENT ON COLUMN refresh_tokens.used_at IS 'Timestamp when token was used to refresh access token (NULL if unused)';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'Timestamp when token was revoked (NULL if active)';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration timestamp';
