-- Add toggle to include long-form pages in full audits (default off)

ALTER TABLE public.brand_voice_profiles
  ADD COLUMN IF NOT EXISTS include_longform_full_audit BOOLEAN NOT NULL DEFAULT false;
