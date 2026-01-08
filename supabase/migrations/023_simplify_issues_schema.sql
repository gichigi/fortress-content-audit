-- Simplify issues schema to match new prompt format
-- Migrates from: title, impact, fix, locations (array)
-- To: page_url, issue_description, suggested_fix

-- Step 1: Update severity enum to include 'critical'
-- PostgreSQL doesn't support IF NOT EXISTS for enum values, so we check first
DO $$ 
BEGIN
  -- Check if 'critical' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'critical' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'issue_severity')
  ) THEN
    ALTER TYPE issue_severity ADD VALUE 'critical';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add new columns
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS page_url TEXT,
  ADD COLUMN IF NOT EXISTS issue_description TEXT,
  ADD COLUMN IF NOT EXISTS suggested_fix TEXT;

-- Step 3: Migrate existing data
-- Combine title + impact into issue_description
-- Extract first URL from locations array to page_url
-- Copy fix to suggested_fix
UPDATE public.issues
SET
  issue_description = CASE
    WHEN impact IS NOT NULL AND impact != '' THEN
      LOWER(SPLIT_PART(impact, ' ', 1)) || ': ' || COALESCE(title, '')
    ELSE
      COALESCE(title, '')
  END,
  page_url = CASE
    WHEN locations IS NOT NULL AND jsonb_array_length(locations) > 0 THEN
      (locations->0->>'url')::TEXT
    ELSE
      NULL
  END,
  suggested_fix = COALESCE(fix, '')
WHERE issue_description IS NULL;

-- Step 4: Make new columns NOT NULL (after migration)
-- First, set defaults for any NULL values
UPDATE public.issues
SET
  issue_description = COALESCE(issue_description, ''),
  page_url = COALESCE(page_url, ''),
  suggested_fix = COALESCE(suggested_fix, '')
WHERE issue_description IS NULL OR page_url IS NULL OR suggested_fix IS NULL;

-- Now make them NOT NULL
ALTER TABLE public.issues
  ALTER COLUMN page_url SET NOT NULL,
  ALTER COLUMN issue_description SET NOT NULL,
  ALTER COLUMN suggested_fix SET NOT NULL;

-- Step 5: Drop old columns
ALTER TABLE public.issues
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS impact,
  DROP COLUMN IF EXISTS fix,
  DROP COLUMN IF EXISTS locations;

-- Step 6: Drop old constraint that checked locations array
ALTER TABLE public.issues
  DROP CONSTRAINT IF EXISTS locations_not_empty;

-- Step 7: Add constraint to ensure page_url is not empty
ALTER TABLE public.issues
  ADD CONSTRAINT page_url_not_empty CHECK (page_url != '');

-- Step 8: Add index on page_url for filtering
CREATE INDEX IF NOT EXISTS idx_issues_page_url ON public.issues(page_url);

-- Step 9: Update category constraint note (categories now: Language, Facts & Consistency, Links & Formatting)
-- Category is TEXT so no enum constraint needed, but we document the new values
COMMENT ON COLUMN public.issues.category IS 'Category: Language, Facts & Consistency, or Links & Formatting';

