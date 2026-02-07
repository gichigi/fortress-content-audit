-- AI-writing check: default off for new profiles (was DEFAULT true).
ALTER TABLE public.brand_voice_profiles
  ALTER COLUMN flag_ai_writing SET DEFAULT false;
