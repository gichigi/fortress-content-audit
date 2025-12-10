-- Add title and brand_name to brand_audit_runs
ALTER TABLE public.brand_audit_runs
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- Create index for brand_name for potential future filtering
CREATE INDEX IF NOT EXISTS idx_brand_audit_runs_brand_name ON public.brand_audit_runs(brand_name);

