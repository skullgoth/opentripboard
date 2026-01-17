-- US9: Share tokens for public trip sharing
-- Migration 006: Create share_tokens table

CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  permission VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON share_tokens(token);

-- Index for finding tokens by trip
CREATE INDEX IF NOT EXISTS idx_share_tokens_trip_id ON share_tokens(trip_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_share_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_share_tokens_updated_at ON share_tokens;
CREATE TRIGGER trigger_share_tokens_updated_at
  BEFORE UPDATE ON share_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_share_tokens_updated_at();
