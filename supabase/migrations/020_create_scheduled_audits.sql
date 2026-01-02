-- Create scheduled_audits table for auto weekly audits
-- Tracks which domains have auto audits enabled and when they last ran

CREATE TABLE IF NOT EXISTS scheduled_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, domain)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_user_id ON scheduled_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_enabled ON scheduled_audits(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_next_run ON scheduled_audits(next_run) WHERE enabled = true;

-- Enable RLS
ALTER TABLE scheduled_audits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own scheduled audits
CREATE POLICY "Users can view their own scheduled audits"
  ON scheduled_audits
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own scheduled audits
CREATE POLICY "Users can insert their own scheduled audits"
  ON scheduled_audits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own scheduled audits
CREATE POLICY "Users can update their own scheduled audits"
  ON scheduled_audits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own scheduled audits
CREATE POLICY "Users can delete their own scheduled audits"
  ON scheduled_audits
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_audits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_scheduled_audits_updated_at
  BEFORE UPDATE ON scheduled_audits
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_audits_updated_at();

