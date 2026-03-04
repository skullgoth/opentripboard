-- Add thumbnail and WebP URL columns for cover images
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_thumbnail_url VARCHAR(500);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_thumbnail_jpeg_url VARCHAR(500);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_image_webp_url VARCHAR(500);
