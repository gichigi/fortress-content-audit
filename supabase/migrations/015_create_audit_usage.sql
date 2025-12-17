-- Create audit_usage table for rate limiting and usage tracking
-- Tracks daily audit counts per user and domain

CREATE TABLE IF NOT EXISTS public.audit_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  date DATE NOT NULL,
  audit_count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, domain, date)
);

-- Enable row level security
ALTER TABLE public.audit_usage ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own usage data
CREATE POLICY "Usage data viewable by owner"
  ON public.audit_usage
  FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_usage_user_date 
  ON public.audit_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_usage_user_domain 
  ON public.audit_usage(user_id, domain);


