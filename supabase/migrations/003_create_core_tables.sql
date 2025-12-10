-- fortress v1
-- Create core tables: guidelines, guideline_versions, brand_audit_runs

-- Create guidelines table
CREATE TABLE IF NOT EXISTS public.guidelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content_md TEXT,
  language_tag TEXT DEFAULT 'en-US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified TIMESTAMPTZ DEFAULT NOW()
);

-- Enable row level security for guidelines
ALTER TABLE public.guidelines ENABLE ROW LEVEL SECURITY;

-- RLS policies for guidelines
CREATE POLICY "Guidelines viewable by owner"
  ON public.guidelines FOR ALL
  USING ( auth.uid() = user_id );

-- Create guideline_versions table
CREATE TABLE IF NOT EXISTS public.guideline_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guideline_id UUID NOT NULL REFERENCES public.guidelines(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_md TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guideline_id, version)
);

-- Create brand_audit_runs table
CREATE TABLE IF NOT EXISTS public.brand_audit_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guideline_id UUID REFERENCES public.guidelines(id) ON DELETE SET NULL,
  domain TEXT,
  pages_scanned INTEGER DEFAULT 0,
  issues_json JSONB,
  is_preview BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable row level security for brand_audit_runs
ALTER TABLE public.brand_audit_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for brand_audit_runs
CREATE POLICY "Audit runs viewable by owner"
  ON public.brand_audit_runs FOR ALL
  USING ( auth.uid() = user_id );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_guidelines_user_id ON public.guidelines(user_id);
CREATE INDEX IF NOT EXISTS idx_guidelines_last_modified ON public.guidelines(last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_guideline_versions_guideline_id ON public.guideline_versions(guideline_id);
CREATE INDEX IF NOT EXISTS idx_brand_audit_runs_user_id ON public.brand_audit_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_audit_runs_created_at ON public.brand_audit_runs(created_at DESC);


