# Implementation Review: Audit UX Fixes

## Overall Rating: 7/10

The implementation addresses the core requirements but has several critical issues that need fixing.

---

## Critical Issues

### 1. **Duplicate Polling** (CRITICAL - Memory Leak)
**Location:** `app/dashboard/page.tsx` lines 880-970

**Problem:** When a user starts a new audit:
- Line 882: `setPendingAuditId(data.runId)` triggers the useEffect (line 267) which starts polling
- Line 884-900: `pollForCompletion()` function also starts its own polling loop
- Result: **Two polling loops running simultaneously** for the same audit

**Impact:** 
- Double API calls every 4 seconds
- Potential race conditions
- Memory leaks from uncleared timeouts

**Fix:** Remove the inline `pollForCompletion()` function entirely. The useEffect should handle ALL polling for pending audits.

---

### 2. **Memory Leak in useEffect** (CRITICAL)
**Location:** `app/dashboard/page.tsx` lines 267-346

**Problem:** The useEffect doesn't have a cleanup function to cancel timeouts when:
- Component unmounts
- `pendingAuditId` changes
- User navigates away

**Impact:** 
- setTimeout calls continue after component unmounts
- Attempts to update state on unmounted components (React warnings)
- Memory leaks

**Fix:** Add cleanup function that stores timeout IDs and clears them:

```typescript
useEffect(() => {
  if (!pendingAuditId || !authToken) return

  let timeoutId: NodeJS.Timeout | null = null
  let isMounted = true
  
  const pollPendingAudit = async () => {
    // ... polling logic
    if (isMounted && attempts < maxAttempts) {
      timeoutId = setTimeout(poll, 4000)
    }
  }

  pollPendingAudit()
  
  return () => {
    isMounted = false
    if (timeoutId) clearTimeout(timeoutId)
  }
}, [pendingAuditId, authToken, selectedDomain, loadAudits, loadHealthScore, loadUsageInfo, toast])
```

---

### 3. **Wrong Date for Claimed Audits** (HIGH PRIORITY)
**Location:** `app/api/audit/claim/route.ts` line 78

**Problem:** When claiming an audit, `incrementAuditUsage()` uses TODAY's date. But the audit may have been run yesterday. Usage should be counted on the audit's actual `created_at` date.

**Example:** 
- User runs audit on Jan 8 (unauthorized)
- User signs up on Jan 9
- Usage is incorrectly counted for Jan 9 instead of Jan 8

**Impact:** 
- Breaks daily limit enforcement (user can run 2 audits on Jan 9)
- Incorrect usage tracking

**Fix:** 
1. Fetch audit's `created_at` date in claim route
2. Create a new function `incrementAuditUsageForDate(userId, domain, date)` 
3. Use the audit's creation date when backfilling usage

---

### 4. **useEffect Dependencies Issue** (MEDIUM)
**Location:** `app/dashboard/page.tsx` line 346

**Problem:** Including `loadAudits`, `loadHealthScore`, `loadUsageInfo` in dependencies causes the effect to re-run when these callbacks change (which happens when `selectedDomain` changes). This can restart polling unnecessarily.

**Impact:** Polling restarts if user switches domains during an audit

**Fix:** Remove these from dependencies and access them via refs, OR wrap the polling logic in a useRef to prevent recreation.

---

## Good Implementation

### ✅ Usage Backfill
The claim route correctly backfills usage - just needs date fix.

### ✅ Pending Audit Detection
Properly detects pending audits on page load.

### ✅ Banner UI
Banner is clear and informative.

### ✅ Auto-refresh
Auto-reloading data instead of full page reload is the right approach.

---

## Recommendations

1. **Consolidate all polling into the useEffect** - Remove inline `pollForCompletion()` 
2. **Add cleanup functions** - Prevent memory leaks
3. **Fix date handling** - Use audit's creation date for claimed audits
4. **Simplify dependencies** - Avoid unnecessary effect re-runs
5. **Add error boundaries** - Handle edge cases gracefully

---

## Quick Wins

1. Remove duplicate polling (5 min fix)
2. Add cleanup to useEffect (5 min fix)  
3. Fix date in claim route (15 min fix - requires new function)

---

## Testing Checklist

- [ ] Start audit from dashboard - verify single polling loop
- [ ] Start audit, navigate away - verify no memory leaks
- [ ] Claim audit from previous day - verify correct date used
- [ ] Switch domains during pending audit - verify polling doesn't restart
- [ ] Refresh page with pending audit - verify polling resumes
- [ ] Multiple rapid audit starts - verify no duplicate polls


