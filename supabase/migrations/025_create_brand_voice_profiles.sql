-- Brand voice: one config row per domain, provenance, and audit snapshot

-- Brand voice profiles (current config per domain)
CREATE TABLE IF NOT EXISTS public.brand_voice_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  readability_level TEXT,
  formality TEXT,
  locale TEXT,
  flag_keywords JSONB DEFAULT '[]'::jsonb,
  ignore_keywords JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  voice_summary TEXT,
  source_domain TEXT,
  source_pages JSONB,
  source_summary TEXT,
  generated_at TIMESTAMPTZ,
  flag_ai_writing BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

ALTER TABLE public.brand_voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand voice profiles viewable by owner"
  ON public.brand_voice_profiles FOR ALL
  USING ( auth.uid() = user_id );

CREATE INDEX IF NOT EXISTS idx_brand_voice_profiles_user_id ON public.brand_voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_voice_profiles_domain ON public.brand_voice_profiles(domain);

-- Audit run stores snapshot of config used (do not mutate profile on audit)
ALTER TABLE public.brand_audit_runs
  ADD COLUMN IF NOT EXISTS brand_voice_config_snapshot JSONB;

-- Guidelines can link to a brand voice profile (one guideline per domain)
ALTER TABLE public.guidelines
  ADD COLUMN IF NOT EXISTS brand_voice_profile_id UUID REFERENCES public.brand_voice_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guidelines_brand_voice_profile_id ON public.guidelines(brand_voice_profile_id);
