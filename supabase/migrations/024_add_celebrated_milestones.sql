-- Add celebrated_milestones column to scheduled_audits table
-- Tracks which health score milestones (75, 85, 95) have been celebrated for each domain
-- This prevents showing the same celebration multiple times

ALTER TABLE scheduled_audits
  ADD COLUMN IF NOT EXISTS celebrated_milestones INTEGER[] DEFAULT ARRAY[]::INTEGER[];

COMMENT ON COLUMN scheduled_audits.celebrated_milestones IS 'Array of celebrated milestone thresholds (75, 85, 95). Prevents duplicate celebrations.';

-- Add index for efficient milestone lookups (GIN index for array containment queries)
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_celebrated_milestones
  ON scheduled_audits USING GIN (celebrated_milestones);
