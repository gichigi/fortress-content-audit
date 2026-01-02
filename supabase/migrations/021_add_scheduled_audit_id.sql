-- Add scheduled_audit_id to brand_audit_runs to track which scheduled audit triggered a run
ALTER TABLE public.brand_audit_runs
ADD COLUMN IF NOT EXISTS scheduled_audit_id UUID REFERENCES public.scheduled_audits(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_brand_audit_runs_scheduled_audit_id 
ON public.brand_audit_runs(scheduled_audit_id) 
WHERE scheduled_audit_id IS NOT NULL;

