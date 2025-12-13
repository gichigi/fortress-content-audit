-- Fix RLS policy for brand_audit_runs to allow unauthenticated audits
-- The original policy only allowed auth.uid() = user_id, which blocks user_id IS NULL
-- This migration updates the policy to allow both authenticated and unauthenticated audits

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Audit runs viewable by owner" ON public.brand_audit_runs;

-- Create new policy that allows:
-- 1. Authenticated users: auth.uid() = user_id (can access their own audits)
-- 2. Unauthenticated inserts: user_id IS NULL (for service role/admin inserts)
-- 3. Service role bypasses RLS entirely, but this makes the policy explicit
-- Note: USING checks existing rows, WITH CHECK validates new/updated rows
CREATE POLICY "Audit runs accessible by owner or unauthenticated"
  ON public.brand_audit_runs
  FOR ALL
  USING (
    -- Authenticated users can access their own audits
    (auth.uid() = user_id)
    OR
    -- Allow unauthenticated audits (user_id IS NULL) - service role/admin can insert
    (user_id IS NULL)
  )
  WITH CHECK (
    -- Allow updates: authenticated users can claim unauthenticated audits
    (auth.uid() = user_id)
    OR
    -- Allow unauthenticated audits to be inserted
    (user_id IS NULL)
  );

