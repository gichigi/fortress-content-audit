-- Rename pages_scanned to pages_audited for clarity
-- This reflects the actual count of pages opened/crawled, not an AI guess
ALTER TABLE public.brand_audit_runs
RENAME COLUMN pages_scanned TO pages_audited;



