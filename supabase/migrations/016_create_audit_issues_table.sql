-- Create audit_issues table for instance-based issue storage
-- Each issue instance (typo, grammar error, etc.) is stored as a separate row

-- Create issue_category_enum type
CREATE TYPE issue_category_enum AS ENUM (
  'typos',
  'grammar',
  'punctuation',
  'seo',
  'links',
  'terminology',
  'factual',
  'other'
);

-- Create issue_severity_enum type (if not exists)
DO $$ BEGIN
  CREATE TYPE issue_severity_enum AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create audit_issues table
CREATE TABLE IF NOT EXISTS public.audit_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.brand_audit_runs(id) ON DELETE CASCADE,
  category issue_category_enum NOT NULL,
  severity issue_severity_enum NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT NOT NULL,
  impact TEXT,
  fix TEXT,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_id, signature)
);

-- Enable row level security
ALTER TABLE public.audit_issues ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access issues from their own audits
CREATE POLICY "Audit issues viewable by audit owner"
  ON public.audit_issues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_audit_runs
      WHERE brand_audit_runs.id = audit_issues.audit_id
      AND brand_audit_runs.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_issues_audit_id 
  ON public.audit_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_category 
  ON public.audit_issues(category);
CREATE INDEX IF NOT EXISTS idx_audit_issues_severity 
  ON public.audit_issues(severity);
CREATE INDEX IF NOT EXISTS idx_audit_issues_signature 
  ON public.audit_issues(signature);
CREATE INDEX IF NOT EXISTS idx_audit_issues_url 
  ON public.audit_issues(url);



