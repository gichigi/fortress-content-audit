# Milestone Celebrations Testing Guide

## What Was Implemented

1. **Chart Visual Indicators**
   - Horizontal reference lines at 75%, 85%, 95% on the health score chart
   - Subtle dashed lines with small labels
   - "Next milestone" indicator below chart

2. **Celebration Logic**
   - Detects when health score crosses milestone thresholds (75, 85, 95)
   - Only celebrates upward crossings
   - Prevents duplicate celebrations via database tracking
   - Shows toast notification with minimal copy

3. **Database Changes**
   - Added `celebrated_milestones` column to `scheduled_audits` table (local only, not yet pushed to cloud)
   - Tracks which milestones have been celebrated per domain

## Testing Checklist

### Setup
- [ ] Local Supabase is running (`npx supabase start`)
- [ ] Local dev server is running (`npm run dev`)
- [ ] You're logged in to the dashboard

### Test 1: Chart Visual Indicators
1. Navigate to dashboard with an existing domain
2. **Verify:** Health score chart shows horizontal dashed lines at 75, 85, 95
3. **Verify:** Small labels "75", "85", "95" appear on the right side of the chart
4. **Verify:** Lines are subtle and don't clutter the chart
5. **Verify:** If score < 95%, you see "Next milestone: X% (+Y points)" below chart

### Test 2: First Milestone Crossing (60 → 80)
1. Create a test audit with ~8-10 issues (should score around 60-70)
2. Note the current health score
3. Resolve some issues to bring score above 75%
4. Run a new audit
5. **Expected:** Toast appears with:
   - Title: "Milestone reached: 75%"
   - Description: "Content health improving"
6. **Verify:** Toast auto-dismisses after 5 seconds
7. **Verify:** Can manually close with X button

### Test 3: Multiple Milestones at Once (60 → 90)
1. Starting from a score around 60-70
2. Resolve enough issues to bring score to 85-90%
3. Run a new audit
4. **Expected:** Two toast notifications:
   - "Milestone reached: 75%"
   - "Milestone reached: 85%"

### Test 4: No Duplicate Celebrations
1. After celebrating 75% milestone
2. Drop score back below 75% (create new issues)
3. Bring score back above 75%
4. Run a new audit
5. **Expected:** NO toast for 75% (already celebrated)

### Test 5: Second Domain
1. Add a new domain to your account
2. Run audit that scores above 75%
3. **Expected:** Toast appears for 75% milestone (each domain tracks separately)

### Test 6: No Celebration for 100%
1. Create an audit with 0 issues (or mock data)
2. **Expected:** NO milestone celebration toast
3. **Reason:** 100% can be a false positive from incomplete audits

### Test 7: Mobile Experience
1. Open dashboard on mobile device or resize browser to mobile width
2. Run audit that crosses milestone
3. **Verify:** Toast appears at top of screen (mobile position)
4. **Verify:** All visual elements work on small screen

## Manual Testing via Database

If you want to test without running real audits:

```sql
-- Check current celebrated milestones for a domain
SELECT domain, celebrated_milestones
FROM scheduled_audits
WHERE user_id = 'YOUR_USER_ID';

-- Reset celebrated milestones for testing
UPDATE scheduled_audits
SET celebrated_milestones = ARRAY[]::INTEGER[]
WHERE user_id = 'YOUR_USER_ID'
AND domain = 'example.com';

-- Manually set celebrated milestones
UPDATE scheduled_audits
SET celebrated_milestones = ARRAY[75]::INTEGER[]
WHERE user_id = 'YOUR_USER_ID'
AND domain = 'example.com';
```

## Known Issues / Edge Cases

- [ ] First audit ever (no previous score) - should celebrate all crossed milestones
- [ ] Audit with errors - should not celebrate milestones
- [ ] Multiple domains - each tracks separately ✓
- [ ] Downward crossing - should not celebrate ✓

## Files Changed

- `supabase/migrations/024_add_celebrated_milestones.sql` - Database migration
- `lib/milestones.ts` - Milestone detection logic
- `components/health-score-chart.tsx` - Visual indicators
- `app/api/audit/route.ts` - Celebration detection on audit completion
- `app/dashboard/page.tsx` - Toast display on poll completion

## After Testing

Once everything looks good:
1. Test in local environment ✓
2. Push migration to cloud: (We'll do this after testing)
3. Deploy frontend changes
4. Monitor for any issues in production

## Rollback Plan

If issues arise:
- Frontend changes are backwards compatible (won't break if migration not applied)
- Database migration uses `IF NOT EXISTS` (safe to re-run)
- Can disable celebrations by reverting `app/api/audit/route.ts` changes
