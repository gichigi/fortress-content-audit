-- Add column to track if completion email was sent
ALTER TABLE public.brand_audit_runs
ADD COLUMN IF NOT EXISTS completion_email_sent BOOLEAN DEFAULT false NOT NULL;

-- Create index for querying audits that need emails
CREATE INDEX IF NOT EXISTS idx_brand_audit_runs_completion_email 
ON public.brand_audit_runs(user_id, completion_email_sent) 
WHERE completion_email_sent = false;

