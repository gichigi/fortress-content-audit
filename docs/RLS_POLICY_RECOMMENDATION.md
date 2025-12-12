# RLS Policy Recommendation for Unauthenticated Audit Access

## Current State

- RLS policy: `auth.uid() = user_id` (works for authenticated users)
- Dashboard queries directly via Supabase client (RLS applies)
- Unauthenticated audits have `user_id = null`, so they're not visible until claimed

## Recommended Solution: Auto-Claim on Dashboard Load

**Why this is simplest:**
- No RLS policy changes needed
- Seamless UX (automatic, no user action)
- Minimal code changes
- Works with existing claim endpoint

**Implementation:**

1. Store `sessionToken` in localStorage when unauthenticated audit completes (already done in API response)
2. On dashboard load (after auth), check localStorage for `sessionToken`
3. If found, automatically call `/api/audit/claim` to transfer ownership
4. Clear localStorage after successful claim

**Flow:**
1. Unauthenticated user runs audit → stored with `session_token`, `user_id = null`
2. User signs up → gets `user_id`
3. User visits dashboard → auto-claim runs (if `sessionToken` in localStorage)
4. Audit now has `user_id` set → RLS policy allows access
5. User sees their mini audit in dashboard immediately

**Code location:**
- Add auto-claim logic to `app/dashboard/page.tsx` in `loadAudits` function or `useEffect` hook
- Check `localStorage.getItem('audit_session_token')` after auth check
- Call `/api/audit/claim` if token exists
- Clear localStorage on success

**Alternative (not recommended):**
- Add RLS policy for `session_token` access, but this requires:
  - Storing session_token in a way frontend can access
  - More complex policy logic
  - Security considerations (anyone with token could access)

**Conclusion:**
Auto-claim on dashboard load is the simplest, most secure, and best UX approach.
