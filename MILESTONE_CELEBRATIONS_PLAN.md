# Milestone Celebrations Implementation Plan

## Overview
Add lightweight gamification to encourage subscription value by celebrating health score milestones (75%, 85%, 95%). Users will see visual indicators of upcoming milestones on the chart and receive minimal toast notifications when crossing thresholds.

## Design Principles
- Minimal design, no emojis
- Reuse existing toast component
- Work with existing chart infrastructure
- Straight edges, generous spacing
- Clear, direct copy

---

## In Scope

### 1. Chart Milestone Indicators
**Visual markers showing milestone thresholds on the health score chart**

- Add reference lines at 75%, 85%, 95% on the YAxis
- Style: Subtle dashed lines using existing border color
- Small text labels on the right edge showing percentage (e.g., "75")
- Avoid interfering with existing CartesianGrid lines

**Implementation:**
- Use Recharts `<ReferenceLine>` component
- Match existing minimal aesthetic
- Use `border` color at reduced opacity for subtlety

### 2. Next Milestone Indicator
**Show users what they're working toward**

Located below the chart, displays:
- Current score
- Next milestone target
- Points needed (e.g., "12 points to 75%")
- Only show if score is below 95%

**Implementation:**
- Simple text-based component
- Typography: sans-serif body text with muted-foreground color
- Layout: Single line, left-aligned

### 3. Milestone Celebration Toast
**Toast notification when crossing a threshold upward**

**Trigger:** After audit completes, if health score crosses 75%, 85%, or 95% threshold

**Toast content:**
- Title: "Milestone reached: 75%" (or 85%, 95%)
- Description: "Content health improving"
- Auto-dismiss after 5 seconds
- Use default toast variant

**Implementation:**
- Add milestone detection logic in audit completion flow
- Compare latest score to previous score
- Check if threshold was crossed upward
- Show toast using existing `useToast()` hook
- Store celebrated milestones in DB to avoid duplicates

### 4. Database Updates
**Track which milestones have been celebrated per domain**

- Add `celebrated_milestones` column to domain/audit table
- Type: `integer[]` storing [75, 85, 95]
- Used to prevent showing same celebration multiple times
- Only celebrate on crossing threshold upward (not re-reaching)

---

## Out of Scope
- Email notifications
- Persistent milestone badges on dashboard
- Celebration history/log
- Team celebrations
- Custom milestone targets
- Monthly recap emails
- Social sharing
- Confetti animations
- 100% health celebration (to avoid false positives from incomplete audits)

---

## Answered Questions

1. **Celebrate 100% health?**
   No. 100% can occur from incomplete/failed audits, creating false positives.

2. **What if score drops below milestone?**
   No warning. Just don't celebrate again if they re-reach the same milestone.

3. **Auto-dismiss or manual?**
   Auto-dismiss after 5 seconds. User can manually close with X button.

4. **Mobile experience?**
   Same toast notification. Existing toast component handles mobile positioning (top on mobile, bottom-right on desktop).

---

## Risk Mitigation

### Risk 1: Chart clutter with multiple reference lines
**Mitigation:**
- Use very subtle styling (low opacity dashed lines)
- Minimal text labels
- Test with different health scores to ensure readability
- If cluttered, consider only showing the next milestone line dynamically

### Risk 2: Duplicate celebrations
**Mitigation:**
- Store `celebrated_milestones` array in database
- Check array before showing toast
- Only add to array when celebration is shown
- Clear strategy: If user drops below and re-crosses, only celebrate once per domain lifecycle

### Risk 3: False positive celebrations from data inconsistencies
**Mitigation:**
- Only detect milestone crossing when comparing consecutive audits
- Require previous audit exists before checking for milestone
- Add validation: score must be valid number between 0-100
- Skip celebration if audit had errors or incomplete status

### Risk 4: Toast spam with multiple domains
**Mitigation:**
- Celebrate per domain, not globally
- Dashboard shows one domain at a time, so only one toast possible
- Store celebrated milestones per domain to prevent cross-domain confusion

### Risk 5: Existing grid lines interference
**Mitigation:**
- Audit existing CartesianGrid implementation first
- Reference lines should layer on top without conflict
- Use different line style (dashed vs solid)
- Test with different time ranges (30/60/90 days)

### Risk 6: Performance impact from DB queries
**Mitigation:**
- `celebrated_milestones` is simple array column, minimal overhead
- Query only on audit completion, not on dashboard load
- Index domain_id if needed for faster lookups

### Risk 7: Inconsistent milestone detection across different chart time ranges
**Mitigation:**
- Milestone detection happens at audit completion time, not chart render time
- Detection logic independent of time range filter
- Uses actual audit data from DB, not filtered chart data

---

## Implementation Checklist

### Phase 1: Database (30 min)
- [ ] Add migration for `celebrated_milestones` column
- [ ] Update domain/audit TypeScript types
- [ ] Test migration on local Supabase

### Phase 2: Chart Visual Updates (2-3 hours)
- [ ] Add ReferenceLine components to HealthScoreChart at 75%, 85%, 95%
- [ ] Style reference lines (subtle, dashed, low opacity)
- [ ] Add small text labels for each milestone
- [ ] Test with different scores to ensure no clutter
- [ ] Verify no interference with existing grid

### Phase 3: Next Milestone Indicator (1-2 hours)
- [ ] Create NextMilestoneIndicator component
- [ ] Calculate next milestone based on current score
- [ ] Add to HealthScoreChart below the chart
- [ ] Hide if score >= 95%

### Phase 4: Celebration Logic (2-3 hours)
- [ ] Create milestone detection utility function
- [ ] Hook into audit completion flow
- [ ] Compare new score to previous score
- [ ] Check if threshold crossed upward
- [ ] Verify milestone not already celebrated
- [ ] Update `celebrated_milestones` in DB
- [ ] Trigger toast notification

### Phase 5: Toast Integration (1 hour)
- [ ] Use existing `useToast()` hook
- [ ] Craft minimal copy for titles/descriptions
- [ ] Set auto-dismiss to 5 seconds
- [ ] Test on desktop and mobile

### Phase 6: Testing & Polish (2 hours)
- [ ] Test with score at 60%, run audit to cross 75%
- [ ] Test with score at 74%, run audit to hit 75%
- [ ] Test with score at 85%, drop to 80%, return to 85% (should not celebrate twice)
- [ ] Test with multiple domains
- [ ] Verify no celebration for 100% health
- [ ] Check for edge cases (first audit, no previous data, etc.)

---

## Copy Guidelines

**Toast titles:**
- "Milestone reached: 75%"
- "Milestone reached: 85%"
- "Milestone reached: 95%"

**Toast descriptions:**
- "Content health improving"

**Next milestone indicator:**
- Current: "Health score: 65/100"
- Target: "Next milestone: 75% (+10 points)"

*Keep all copy minimal, direct, no emojis or exclamation marks.*

---

## Success Criteria

1. Users see visual milestone markers on chart without clutter
2. Users understand what they're working toward via next milestone indicator
3. Celebration toast appears once when crossing threshold
4. No duplicate celebrations for same milestone
5. No performance degradation
6. Design matches existing minimal aesthetic
7. Works on mobile and desktop
8. No celebration for 100% health

---

## Estimated Effort
**Total: 8-12 hours**

Breakdown:
- Database: 30 min
- Chart updates: 2-3 hours
- Next milestone UI: 1-2 hours
- Celebration logic: 2-3 hours
- Toast integration: 1 hour
- Testing: 2 hours
