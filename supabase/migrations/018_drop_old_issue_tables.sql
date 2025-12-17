-- Phase 3: Drop old issue tables after migration is complete
-- This migration drops the old audit_issues and audit_issue_states tables
-- Only run this after verifying the new issues table is working correctly

-- Drop old tables
DROP TABLE IF EXISTS public.audit_issues;
DROP TABLE IF EXISTS public.audit_issue_states;

-- Drop old enum types (if they exist and aren't used elsewhere)
DROP TYPE IF EXISTS issue_category_enum;
DROP TYPE IF EXISTS issue_severity_enum;  -- Note: We created a new issue_severity enum
DROP TYPE IF EXISTS issue_state_enum;    -- Note: We created a new issue_status enum


