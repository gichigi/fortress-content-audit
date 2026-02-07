-- Brand voice: master enable/disable. Default OFF for new users; when OFF we skip the BV audit pass.
ALTER TABLE public.brand_voice_profiles
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.brand_voice_profiles.enabled IS 'When true, run brand voice audit pass. Default false for new profiles.';
