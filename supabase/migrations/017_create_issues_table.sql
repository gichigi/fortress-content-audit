-- Create new simplified issues table (Phase 1 of Issue Model Simplification)
-- This replaces the instance-based audit_issues table with a simpler model
-- where each issue = one actionable item

-- Create issue_severity enum (replaces issue_severity_enum)
DO $$ BEGIN
  CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create issue_status enum (replaces issue_state_enum)
DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('active', 'ignored', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create issues table
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.brand_audit_runs(id) ON DELETE CASCADE,
  
  -- What's wrong (actionable title)
  title TEXT NOT NULL,
  
  -- Metadata for filtering (category optional - severity is primary grouping)
  category TEXT,  -- Optional: 'typos', 'grammar', 'seo', 'factual', 'links', 'terminology'
  severity issue_severity NOT NULL,
  
  -- Context
  impact TEXT,
  fix TEXT,
  
  -- Where to fix (always an array, even if just 1 location)
  locations JSONB NOT NULL DEFAULT '[]',  -- [{url, snippet}]
  
  -- State (on the row, not separate table)
  status issue_status NOT NULL DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure locations array is not empty
  CONSTRAINT locations_not_empty CHECK (jsonb_array_length(locations) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_issues_audit_id ON public.issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON public.issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);

-- RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issues viewable by audit owner"
  ON public.issues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_audit_runs
      WHERE brand_audit_runs.id = issues.audit_id
      AND brand_audit_runs.user_id = auth.uid()
    )
  );

-- Delete all existing data from old tables (pre-launch cleanup)
DELETE FROM public.audit_issues;
DELETE FROM public.audit_issue_states;



