-- fortress v1
-- Add language_tag column to guidelines table for locale support

ALTER TABLE guidelines
ADD COLUMN IF NOT EXISTS language_tag TEXT DEFAULT 'en-US';

COMMENT ON COLUMN guidelines.language_tag IS 'BCP-47 language tag (e.g., en-US, en-GB, es-ES) for locale-specific generation';

