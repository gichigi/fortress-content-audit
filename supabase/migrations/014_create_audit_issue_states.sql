-- Create audit_issue_states table for issue state management (Phase 4)
-- Allows users to mark issues as active, ignored, or resolved

-- Create issue_state_enum type
CREATE TYPE issue_state_enum AS ENUM ('active', 'ignored', 'resolved');

-- Create audit_issue_states table
CREATE TABLE IF NOT EXISTS public.audit_issue_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  signature TEXT NOT NULL,
  state issue_state_enum NOT NULL DEFAULT 'active',
  audit_run_id UUID REFERENCES public.brand_audit_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, domain, signature)
);

-- Enable row level security
ALTER TABLE public.audit_issue_states ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own issue states
CREATE POLICY "Issue states viewable by owner"
  ON public.audit_issue_states
  FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_issue_states_signature 
  ON public.audit_issue_states(signature);
CREATE INDEX IF NOT EXISTS idx_audit_issue_states_user_domain_signature 
  ON public.audit_issue_states(user_id, domain, signature);
CREATE INDEX IF NOT EXISTS idx_audit_issue_states_user_state_updated 
  ON public.audit_issue_states(user_id, state, updated_at);



