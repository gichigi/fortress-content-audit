-- Add session_token to brand_audit_runs for unauthenticated audit persistence
-- Allows users to claim audits after signing up

ALTER TABLE public.brand_audit_runs
ADD COLUMN session_token TEXT;

-- Make user_id nullable so unauthenticated audits can be stored
ALTER TABLE public.brand_audit_runs
ALTER COLUMN user_id DROP NOT NULL;

-- Index for fast lookup when claiming audits by session token
CREATE INDEX idx_brand_audit_runs_session_token 
ON public.brand_audit_runs(session_token) 
WHERE session_token IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.brand_audit_runs.session_token IS 
  'Temporary token for unauthenticated audits. Used to claim audit after user signs up.';

