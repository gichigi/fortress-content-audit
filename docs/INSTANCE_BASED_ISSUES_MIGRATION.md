# Instance-Based Issues Migration Plan

## Executive Summary

**Current State:** Issues are stored as grouped structures in JSONB (`brand_audit_runs.issues_json`), with one signature per group.

**Target State:** Issues stored as individual instances in a dedicated table (`audit_issues`), with one signature per instance. UI groups instances dynamically by category.

**Migration Required:** ✅ YES - Significant data model changes needed.

**Risk Level:** Low (pre-launch, no live user data to preserve)

**Status:** Pre-launch - can make breaking changes freely, no backward compatibility needed

---

## Current Architecture

### Data Storage
- **Location:** `brand_audit_runs.issues_json` (JSONB column)
- **Structure:**
  ```json
  {
    "groups": [
      {
        "title": "Punctuation errors",
        "severity": "low",
        "impact": "...",
        "fix": "...",
        "examples": [
          { "url": "/page1", "snippet": "Hello world" },
          { "url": "/page2", "snippet": "Goodbye world" }
        ],
        "count": 2
      }
    ],
    "auditedUrls": ["/page1", "/page2"]
  }
  ```

### Issue State Management
- **Table:** `audit_issue_states`
- **Signature Generation:** `SHA256(url + normalized_title)` - **one per group**
- **Current Behavior:** One signature = one group = multiple instances

### Health Score Calculation
- **Formula:** `100 - (low×1 + medium×3 + high×7) - (criticalPages×10)`
- **Counts:** Groups, not instances
- **Location:** `lib/health-score.ts`

---

## Target Architecture

### Data Storage
- **New Table:** `audit_issues`
  ```sql
  CREATE TABLE audit_issues (
    id UUID PRIMARY KEY,
    audit_id UUID REFERENCES brand_audit_runs(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'typos', 'grammar', 'seo', 'links', etc.
    severity 'low' | 'medium' | 'high' NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    snippet TEXT NOT NULL,
    impact TEXT,
    fix TEXT,
    signature TEXT NOT NULL, -- SHA256(url + normalized_title + snippet)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(audit_id, signature)
  );
  ```

- **Legacy Support:** None needed (pre-launch). Can deprecate `issues_json` immediately or keep as backup.

### Issue State Management
- **Table:** `audit_issue_states` (existing, but signatures change)
- **New Signature Generation:** `SHA256(url + normalized_title + snippet)` - **one per instance**
- **Migration Strategy:** None needed - no existing states to preserve (pre-launch)

### Health Score Calculation
- **New Formula:** Count instances, not groups
- **Update:** `lib/health-score.ts` to query `audit_issues` table

---

## Migration Requirements

### ✅ Migration Needed - Reasons:

1. **Signature Mismatch**
   - Old: `SHA256(url + normalized_title)` → one per group
   - New: `SHA256(url + normalized_title + snippet)` → one per instance
   - **Impact:** None - no existing states to preserve (pre-launch)

2. **Data Structure Change**
   - Current: Nested JSONB with groups
   - New: Relational table with flat instances
   - **Impact:** Minimal - only need to migrate any test/demo audit data (if any exists)

3. **Health Score Formula**
   - Current: Counts groups
   - New: Counts instances
   - **Impact:** Scores will change dramatically (20 typos = 20 issues vs 1 group)

4. **API Endpoints**
   - Current: Read from `issues_json`
   - New: Query `audit_issues` table
   - **Impact:** All audit reading endpoints need updates

---

## Pre-Migration Checklist

**Status: Pre-Launch** ✅

Since you haven't launched yet:
- ✅ No user states to preserve
- ✅ No production data to worry about
- ✅ Can make breaking changes freely
- ✅ No backward compatibility needed
- ✅ Can simplify migration significantly

**Optional: Check for any test data:**
```sql
-- Check if any audits exist (test/demo data)
SELECT COUNT(*) FROM public.brand_audit_runs;

-- Check if any states exist (should be 0)
SELECT COUNT(*) FROM public.audit_issue_states;
```

**If test data exists:** Migrate it (simple backfill)
**If no data:** Start fresh with new structure

---

## Migration Strategy

### Phase 1: Schema Creation (Non-Breaking)

**Goal:** Add new table without breaking existing functionality

**Steps:**
1. Create `audit_issues` table with indexes
2. Create `audit_issue_categories` enum or lookup table
3. Update signature generation to include snippet
4. **No dual-write needed** - can switch immediately (pre-launch)

**Migration File:** `016_create_audit_issues_table.sql`

```sql
-- Create category enum (or use TEXT with CHECK constraint)
CREATE TYPE issue_category_enum AS ENUM (
  'typos',
  'grammar',
  'punctuation',
  'seo',
  'links',
  'terminology',
  'factual',
  'other'
);

-- Create audit_issues table
CREATE TABLE IF NOT EXISTS public.audit_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.brand_audit_runs(id) ON DELETE CASCADE,
  category issue_category_enum NOT NULL,
  severity issue_severity_enum NOT NULL, -- Reuse existing or create new
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT NOT NULL,
  impact TEXT,
  fix TEXT,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audit_id, signature)
);

-- Indexes for performance
CREATE INDEX idx_audit_issues_audit_id ON public.audit_issues(audit_id);
CREATE INDEX idx_audit_issues_category ON public.audit_issues(category);
CREATE INDEX idx_audit_issues_severity ON public.audit_issues(severity);
CREATE INDEX idx_audit_issues_signature ON public.audit_issues(signature);
CREATE INDEX idx_audit_issues_url ON public.audit_issues(url);

-- RLS policies
ALTER TABLE public.audit_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit issues viewable by audit owner"
  ON public.audit_issues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_audit_runs
      WHERE brand_audit_runs.id = audit_issues.audit_id
      AND brand_audit_runs.user_id = auth.uid()
    )
  );
```

**Rollback:** Drop table if issues found

---

### Phase 2: Data Migration (Backfill Test Data - Optional)

**Goal:** Extract instances from any existing test/demo `issues_json` and populate `audit_issues`

**Steps:**
1. Check if any audits exist (likely none or minimal test data)
2. If audits exist, create simple migration script to:
   - Read all `brand_audit_runs` with `issues_json`
   - Extract groups → expand to instances
   - Derive category from title (pattern matching)
   - Generate instance-level signatures
   - Insert into `audit_issues`
3. Run migration script (if needed)
4. Verify data integrity

**Note:** If no test data exists, skip this phase entirely.

**Migration File:** `017_migrate_issues_json_to_instances.sql` (or TypeScript script)

**Category Derivation Logic:**
```typescript
function deriveCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('typo') || lower.includes('spelling')) return 'typos';
  if (lower.includes('grammar')) return 'grammar';
  if (lower.includes('punctuation')) return 'punctuation';
  if (lower.includes('seo') || lower.includes('meta') || lower.includes('alt')) return 'seo';
  if (lower.includes('link') || lower.includes('404') || lower.includes('broken')) return 'links';
  if (lower.includes('terminology') || lower.includes('inconsistent')) return 'terminology';
  if (lower.includes('factual') || lower.includes('contradiction')) return 'factual';
  return 'other';
}
```

**Signature Migration Strategy:**
- **Option A (Conservative):** Keep old signatures in `audit_issue_states`, create mapping table
- **Option B (Clean):** Attempt to match old group signatures to new instance signatures
- **Recommendation:** Option A - preserve user state, create mapping

**Migration Script Structure:**
```typescript
// scripts/migrate-issues-to-instances.ts
async function migrateIssuesToInstances() {
  const audits = await getAllAudits();
  
  for (const audit of audits) {
    const groups = audit.issues_json?.groups || [];
    
    for (const group of groups) {
      const category = deriveCategory(group.title);
      
      for (const example of group.examples || []) {
        const signature = generateInstanceSignature({
          url: example.url,
          title: group.title,
          snippet: example.snippet
        });
        
        await insertAuditIssue({
          audit_id: audit.id,
          category,
          severity: group.severity,
          title: group.title,
          url: example.url,
          snippet: example.snippet,
          impact: group.impact,
          fix: group.fix,
          signature
        });
      }
    }
  }
}
```

**Rollback:** Delete all rows from `audit_issues` where `created_at < migration_timestamp`

---

### Phase 3: Signature Mapping - **SKIP (Pre-Launch)**

**Status:** Not needed - no existing user states to preserve.

**Why skip:**
- Pre-launch = no production data
- No ignored/resolved states exist
- No signature mapping required
- Can use new signature format immediately

**Action:** Proceed directly to Phase 4.

---

### Phase 3: Signature Mapping - **SKIP (Pre-Launch)**

**Status:** Not needed - no existing user states to preserve.

**Action:** Proceed directly to Phase 4.

---

### Phase 4: Update Application Code

**Goal:** Switch from JSONB reading to table queries

**Files to Update:**

1. **`lib/audit.ts`**
   - After audit completes, write to `audit_issues` table
   - Update `parseAuditResponse` to extract instances
   - **Optional:** Keep writing to `issues_json` as backup (can remove later)

2. **`lib/audit-table-adapter.ts`**
   - New function: `transformInstancesToTableRows(instances, groupBy: 'category' | 'url')`
   - Group instances dynamically in UI layer

3. **`lib/health-score.ts`**
   - Query `audit_issues` table instead of `issues_json`
   - Count instances, not groups

4. **`lib/issue-signature.ts`**
   - Update `generateIssueSignature` to include snippet
   - Add backward compatibility function

5. **API Endpoints:**
   - `app/api/audit/[id]/route.ts` - Query `audit_issues`
   - `app/api/audit/poll/route.ts` - Query `audit_issues`
   - `app/api/audit/[id]/issues/[signature]/route.ts` - Already uses signatures (needs update)

6. **Components:**
   - `components/data-table.tsx` - Support nested rows
   - `components/audit-table.tsx` - Update data fetching

---

### Phase 5: UI Updates

**Goal:** Display instances as nested rows with grouping

**Changes:**

1. **Table Structure:**
   - Parent rows: Groups (by category + severity)
   - Child rows: Individual instances (when expanded)
   - Columns: Category, Issue, Severity, URL, Actions

2. **Grouping Logic:**
   ```typescript
   function groupInstances(instances: AuditIssue[]) {
     const groups = new Map<string, AuditIssue[]>();
     
     instances.forEach(issue => {
       const key = `${issue.category}-${issue.severity}`;
       if (!groups.has(key)) groups.set(key, []);
       groups.get(key)!.push(issue);
     });
     
     return Array.from(groups.entries()).map(([key, issues]) => ({
       category: issues[0].category,
       severity: issues[0].severity,
       title: `${issues[0].category} issues`,
       count: issues.length,
       instances: issues
     }));
   }
   ```

3. **Nested Row Component:**
   - Expandable parent row
   - Virtual scrolling for large instance lists
   - Pagination within groups (show 10, "load more")

4. **Filtering:**
   - Filter by category (tags)
   - Filter by severity
   - Filter by URL
   - Search across snippets

---

## Testing Strategy

### Unit Tests
- [ ] Signature generation (old vs new)
- [ ] Category derivation from titles
- [ ] Instance extraction from groups
- [ ] Grouping logic
- [ ] Health score calculation (instances)

### Integration Tests
- [ ] Migration script (backfill)
- [ ] Signature mapping
- [ ] API endpoints (read instances)
- [ ] State management (ignore/resolve instances)

### E2E Tests
- [ ] Create new audit → instances stored correctly
- [ ] View audit → instances display correctly
- [ ] Ignore instance → state persists
- [ ] Health score updates correctly

### Data Validation
- [ ] All existing audits have instances
- [ ] No orphaned instances
- [ ] Signature uniqueness maintained
- [ ] State mappings correct

---

## Rollback Plan (Pre-Launch)

### If Migration Fails

**Simplified rollback (no production data to worry about):**

1. **Phase 1 Rollback:**
   ```sql
   DROP TABLE IF EXISTS public.audit_issues;
   DROP TYPE IF EXISTS issue_category_enum;
   ```

2. **Phase 2 Rollback:**
   ```sql
   DELETE FROM public.audit_issues WHERE created_at < 'migration_timestamp';
   ```
   (Only needed if test data was migrated)

3. **Code Rollback:**
   - Revert git commits
   - Switch back to `issues_json` reading
   - No data loss risk (pre-launch)

### Data Backup
- **Optional:** Export any test `issues_json` data (if exists)
- **Not critical:** No production data to preserve

---

## Performance Considerations

### Database
- **Indexes:** Already planned in Phase 1
- **Query Optimization:** Use `EXPLAIN ANALYZE` on instance queries
- **Partitioning:** Consider partitioning `audit_issues` by `audit_id` if table grows large

### Application
- **Virtual Scrolling:** Implement for large instance lists
- **Pagination:** Paginate instances within groups
- **Caching:** Cache grouped views

### Migration
- **Batch Processing:** Process audits in batches (100 at a time)
- **Progress Tracking:** Log migration progress
- **Resume Capability:** Allow migration to resume if interrupted

---

## Timeline Estimate (Pre-Launch)

- **Phase 1 (Schema):** 2-4 hours
- **Phase 2 (Data Migration):** 0-2 hours (likely skip - no test data)
- **Phase 3 (Signature Mapping):** 0 hours (skip - pre-launch)
- **Phase 4 (Code Updates):** 8-12 hours
- **Phase 5 (UI Updates):** 8-12 hours
- **Testing:** 4-6 hours
- **Total:** 22-36 hours (~3-5 days for one developer)

**Simplified because:**
- No backward compatibility needed
- No state preservation needed
- No dual-write complexity
- Can make breaking changes freely

---

## Success Criteria

- [ ] `audit_issues` table created with proper indexes
- [ ] New audits write instances to table (not JSONB)
- [ ] Health scores calculated from instances
- [ ] UI displays instances grouped by category
- [ ] Performance acceptable (< 500ms for audit load)
- [ ] Signature generation includes snippet
- [ ] All API endpoints query `audit_issues` table
- [ ] Optional: Test data migrated (if any exists)

---

## Open Questions

1. **Category Derivation:** Should we ask OpenAI to classify categories, or use pattern matching?
   - **Recommendation:** Start with pattern matching, add AI classification later

2. **Group State vs Instance State:** If user ignores a group, should all instances be ignored?
   - **Recommendation:** Yes, add "group state" concept (for future)

3. **Keep `issues_json`?** Should we keep writing to JSONB as backup or remove entirely?
   - **Recommendation:** Keep as backup during development, remove before launch

4. **Migration Timing:** When to run migration?
   - **Recommendation:** Anytime - no production impact (pre-launch)

---

## Next Steps

1. Review and approve this plan
2. Create feature branch: `feature/instance-based-issues`
3. Start with Phase 1 (schema creation)
4. Test migration on staging environment
5. Schedule production migration window
6. Execute migration phases sequentially
7. Monitor for issues post-migration

