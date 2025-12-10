-- fortress v1
-- Create brand_onboarding table for session-based onboarding persistence
-- Supports both unauthenticated (session_token) and authenticated (user_id) flows

CREATE TABLE IF NOT EXISTS public.brand_onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_details JSONB,
  clarifying_answers JSONB,
  ab_rounds JSONB,
  voice_profile JSONB,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure either session_token or user_id is set
  CONSTRAINT brand_onboarding_identifier_check CHECK (
    (session_token IS NOT NULL) OR (user_id IS NOT NULL)
  )
);

-- Enable row level security
ALTER TABLE public.brand_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS policies for brand_onboarding
-- Users can only access their own records (by user_id)
CREATE POLICY "brand_onboarding_select_own"
  ON public.brand_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "brand_onboarding_insert_own"
  ON public.brand_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "brand_onboarding_update_own"
  ON public.brand_onboarding FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "brand_onboarding_delete_own"
  ON public.brand_onboarding FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_onboarding_session_token ON public.brand_onboarding(session_token);
CREATE INDEX IF NOT EXISTS idx_brand_onboarding_user_id ON public.brand_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_onboarding_status ON public.brand_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_brand_onboarding_created_at ON public.brand_onboarding(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_brand_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER brand_onboarding_updated_at
  BEFORE UPDATE ON public.brand_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_onboarding_updated_at();

