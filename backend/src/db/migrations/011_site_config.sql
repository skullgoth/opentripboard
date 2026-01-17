-- Migration: 011_site_config
-- Description: Create site_config table for site-wide configuration settings
-- Feature: Enable/disable user registration

-- Create site_config table (key-value store)
CREATE TABLE IF NOT EXISTS site_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for key lookups
CREATE INDEX IF NOT EXISTS idx_site_config_key ON site_config(key);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_site_config_updated_at ON site_config;
CREATE TRIGGER update_site_config_updated_at
    BEFORE UPDATE ON site_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration: registration enabled
INSERT INTO site_config (key, value, description)
VALUES (
    'registration_enabled',
    'true'::jsonb,
    'Controls whether new user registration is allowed'
)
ON CONFLICT (key) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE site_config IS 'Site-wide configuration settings stored as key-value pairs';
COMMENT ON COLUMN site_config.key IS 'Unique configuration key identifier';
COMMENT ON COLUMN site_config.value IS 'Configuration value stored as JSONB for flexibility';
COMMENT ON COLUMN site_config.description IS 'Human-readable description of the setting';
