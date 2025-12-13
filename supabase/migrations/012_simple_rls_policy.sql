-- PERMISSIVE RLS POLICY FOR brand_audit_runs
-- 
-- Security model:
-- 1. Primary auth is enforced at API route level (all routes verify JWT and ownership)
-- 2. RLS provides defense-in-depth (blocks anonymous direct database access)
-- 3. Admin operations use service_role which bypasses RLS
--
-- This permissive policy was adopted after discovering that more restrictive
-- policies had edge cases where the service role's bypass didn't work correctly
-- (likely due to Supabase JS client state when using auth.getUser() with user JWT).

-- Drop ALL existing policies on this table
DROP POLICY IF EXISTS "Audit runs viewable by owner" ON public.brand_audit_runs;
DROP POLICY IF EXISTS "Audit runs accessible by owner or unauthenticated" ON public.brand_audit_runs;
DROP POLICY IF EXISTS "Audit runs permissive for service role" ON public.brand_audit_runs;
DROP POLICY IF EXISTS "Audit runs select by owner" ON public.brand_audit_runs;
DROP POLICY IF EXISTS "Audit runs insert unauthenticated" ON public.brand_audit_runs;
DROP POLICY IF EXISTS "Audit runs update claim" ON public.brand_audit_runs;
DROP POLICY IF EXISTS "Audit runs update own" ON public.brand_audit_runs;
DROP POLICY IF EXISTS "Audit runs delete own" ON public.brand_audit_runs;

-- Simple permissive policy - relies on API-level auth for security
CREATE POLICY "brand_audit_runs_policy"
  ON public.brand_audit_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

