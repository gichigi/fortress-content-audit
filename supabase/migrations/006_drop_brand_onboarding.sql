-- Drop brand_onboarding table and related objects
-- This table was used for brand voice onboarding flow which has been removed

-- Drop trigger first
DROP TRIGGER IF EXISTS brand_onboarding_updated_at ON public.brand_onboarding;

-- Drop function
DROP FUNCTION IF EXISTS update_brand_onboarding_updated_at();

-- Drop policies
DROP POLICY IF EXISTS "brand_onboarding_select_own" ON public.brand_onboarding;
DROP POLICY IF EXISTS "brand_onboarding_insert_own" ON public.brand_onboarding;
DROP POLICY IF EXISTS "brand_onboarding_update_own" ON public.brand_onboarding;
DROP POLICY IF EXISTS "brand_onboarding_delete_own" ON public.brand_onboarding;

-- Drop indexes
DROP INDEX IF EXISTS idx_brand_onboarding_session_token;
DROP INDEX IF EXISTS idx_brand_onboarding_user_id;
DROP INDEX IF EXISTS idx_brand_onboarding_status;
DROP INDEX IF EXISTS idx_brand_onboarding_created_at;

-- Drop table
DROP TABLE IF EXISTS public.brand_onboarding;





