# Issue Model Simplification

## Problem Statement

The current implementation is over-engineered. We have:
- Instance-based storage (40 rows for 10 actual issues)
- Separate signature systems (group vs instance)
- Separate state table (`audit_issue_states`)
- Complex UI with nested rows
- Health score counting instances instead of actionable issues

**Root cause**: We conflated "occurrences" with "issues". An issue is something you action, not something you count.

---

## New Mental Model

**An issue = one action item.** Something you can check off a to-do list.

| Old Way | New Way |
|---------|---------|
| "Typos and Spelling Errors" (3 instances) | 3 separate issues: "Fix typo: 'suport' → 'support'" |
| "Factual Contradictions" (2 instances) | 1 issue: "Pricing conflict: $29 vs $39" (2 locations) |
| Count instances for health score | Count issues for health score |
| Generic titles | Specific, actionable titles |
| Separate state table | Status on the issue row |

### UI Reference

Target UI appearance showing single-location issues and expandable multi-location issues:

```
┌──────────────────────────────────────────────────────────────────┐
│ [All] [Typos] [SEO] [Factual] [Links]            🔍 Search       │
├──────────────────────────────────────────────────────────────────┤
│ ☐  Fix typo: 'suport' → 'support'      MEDIUM    /support       │
│ ☐  Fix typo: 'Maxx' → 'Max'            MEDIUM    /products      │
│ ☐  Pricing conflict: $29 vs $39        HIGH      2 pages    ▼   │
│    ├─ /pricing: "Starting at $29/month"                         │
│    └─ /features: "Plans start at $39/month"                     │
│ ☐  Add H1 tag                          MEDIUM    /products      │
│ ☐  Add H1 tag                          MEDIUM    /about         │
└──────────────────────────────────────────────────────────────────┘
```

Key points:
- Single-location issues: One row, no expansion
- Multi-location issues: Show count badge ("2 pages") with ▼ indicator, expand to show locations
- Each row = one actionable issue
- Locations shown as indented list under expanded row

---

## Database Changes

### DELETE: `audit_issues` table (current)
```sql
DROP TABLE IF EXISTS public.audit_issues;
DROP TYPE IF EXISTS issue_category_enum;
```

### DELETE: `audit_issue_states` table
```sql
DROP TABLE IF EXISTS public.audit_issue_states;
DROP TYPE IF EXISTS issue_state_enum;
```

### CREATE: `issues` table (new, simpler)
```sql
CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'critical');
CREATE TYPE issue_status AS ENUM ('active', 'ignored', 'resolved');

CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.brand_audit_runs(id) ON DELETE CASCADE,
  
  -- What's wrong (combined impact + description)
  issue_description TEXT NOT NULL,  -- Format: "impact_word: description"
  
  -- Metadata for filtering
  category TEXT NOT NULL,  -- 'Language', 'Facts & Consistency', 'Links & Formatting'
  severity issue_severity NOT NULL,
  
  -- Fix suggestion
  suggested_fix TEXT NOT NULL,
  
  -- Where to fix (single page URL)
  page_url TEXT NOT NULL,
  
  -- State (on the row, not separate table)
  status issue_status NOT NULL DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_issues_audit_id ON public.issues(audit_id);
CREATE INDEX idx_issues_severity ON public.issues(severity);
CREATE INDEX idx_issues_status ON public.issues(status);
-- Optional: Only if keeping category for filtering
-- CREATE INDEX idx_issues_category ON public.issues(category);

-- RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issues viewable by audit owner"
  ON public.issues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_audit_runs
      WHERE brand_audit_runs.id = issues.audit_id
      AND brand_audit_runs.user_id = auth.uid()
    )
  );
```

### KEEP (no change): `brand_audit_runs`
- Keep `issues_json` column as backup/legacy during transition
- Can remove later once migration is complete

### DELETE: All existing audit data (pre-launch cleanup)
Since we're pre-launch and the old format won't work with the new schema, delete existing data:

```sql
-- Delete all existing audit data
DELETE FROM public.audit_issues;
DELETE FROM public.audit_issue_states;

-- Optionally, delete all audits to start fresh
-- (Only if you want a completely clean slate)
-- DELETE FROM public.brand_audit_runs;
```

**Note**: If you have test/demo audits you want to preserve, you'd need to migrate them first (convert old format to new format). But for pre-launch, starting fresh is simpler.

---

## Code Deletions

### DELETE: `lib/issue-signature.ts`
No longer needed. We use issue `id` directly.

### DELETE: `scripts/migrate-issues-to-instances.ts`
No longer needed.

### DELETE: `docs/INSTANCE_BASED_ISSUES_MIGRATION.md`
Superseded by this doc.

---

## Code Modifications

### `lib/audit.ts` - Update Prompt

**Current prompt** (line 47):
```
Important: Group similar issues together. For example, if you find the same typo...
```

**New prompt**:
```
CRITICAL FORMATTING RULES:

For POINT issues (typos, grammar, punctuation, broken links, missing SEO elements):
- Create ONE issue per occurrence
- Title must be specific and actionable (e.g., "Fix typo: 'suport' → 'support'")
- Include single location

For RELATIONAL issues (factual contradictions, terminology inconsistencies, duplicate content):
- Create ONE issue that describes the conflict
- Title must describe the relationship (e.g., "Pricing conflict: $29 vs $39")
- Include ALL conflicting locations

Each issue should be something a person can check off a to-do list.
```

**Update JSON schema**:
```typescript
const AUDIT_JSON_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },      // Specific, actionable
          category: { type: "string" },   // Optional: typos, grammar, seo, etc.
          severity: { type: "string", enum: ["low", "medium", "high"] },
          impact: { type: "string" },
          fix: { type: "string" },
          locations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                snippet: { type: "string" }
              },
              required: ["url", "snippet"]
            }
          }
        },
        required: ["title", "severity", "locations"]  // category optional
      }
    },
    pagesScanned: { type: "integer" },
    auditedUrls: { type: "array", items: { type: "string" } }
  },
  required: ["issues", "pagesScanned", "auditedUrls"]
}
```

### `lib/audit.ts` - Update `parseAuditResponse`

Remove instance extraction. Just save issues directly:

```typescript
// Old: extractInstancesFromGroups(groups)
// New: Just use the issues array directly

function parseAuditResponse(response: any, tier: AuditTier): AuditResult {
  // ... parse JSON from response
  
  return {
    issues: parsedData.issues,  // Direct, no transformation
    pagesScanned: parsedData.pagesScanned,
    auditedUrls: parsedData.auditedUrls,
    // ...
  }
}
```

### `lib/audit-table-adapter.ts` - Simplify

**DELETE** these functions:
- `deriveCategory()` - model provides category (or we don't use it)
- `transformInstancesToTableRows()` - no more instances
- `generateIssueSignature()` import

**SIMPLIFY** to:
```typescript
export interface AuditTableRow {
  id: string
  title: string
  category?: string  // Optional - can remove if not using
  severity: 'low' | 'medium' | 'high'
  impact: string
  fix: string
  locations: Array<{ url: string; snippet: string }>
  status: 'active' | 'ignored' | 'resolved'
}

export function transformIssuesToTableRows(issues: any[]): AuditTableRow[] {
  return issues.map(issue => ({
    id: issue.id,
    title: issue.title,
    category: issue.category,  // Optional
    severity: issue.severity,
    impact: issue.impact || '',
    fix: issue.fix || '',
    locations: issue.locations || [],
    status: issue.status || 'active',
  }))
}
```

**Note**: If dropping category entirely, remove the category column from the UI table and remove it from this interface.

### `lib/health-score.ts` - Simplify

**Current**: Queries `audit_issues`, counts instances, calculates critical pages
**New**: Query `issues`, count rows, extract unique pages from locations array

```typescript
export async function calculateHealthScore(auditId: string): Promise<HealthScoreResult> {
  const { data: issues } = await supabaseAdmin
    .from('issues')
    .select('severity, status, locations')
    .eq('audit_id', auditId)
    .eq('status', 'active')  // Only active issues

  const bySeverity = { low: 0, medium: 0, high: 0 }
  const pagesWithIssuesSet = new Set<string>()
  const criticalPagesSet = new Set<string>()

  issues?.forEach(issue => {
    bySeverity[issue.severity]++
    
    // Extract unique pages from locations array
    if (issue.locations && Array.isArray(issue.locations)) {
      issue.locations.forEach((loc: { url: string }) => {
        try {
          const url = new URL(loc.url)
          const pagePath = url.pathname || '/'
          pagesWithIssuesSet.add(pagePath)
          
          // If high severity, mark page as critical
          if (issue.severity === 'high') {
            criticalPagesSet.add(pagePath)
          }
        } catch (e) {
          console.warn('[HealthScore] Invalid URL in locations:', loc.url)
        }
      })
    }
  })

  let score = 100
  score -= bySeverity.low * 1
  score -= bySeverity.medium * 3
  score -= bySeverity.high * 7
  score -= criticalPagesSet.size * 10  // Critical pages penalty
  
  return {
    score: Math.max(0, Math.min(100, score)),
    metrics: {
      totalActive: issues?.length || 0,
      totalCritical: bySeverity.high,
      bySeverity,
      criticalPages: criticalPagesSet.size,
      pagesWithIssues: pagesWithIssuesSet.size,
    }
  }
}
```

### `lib/mock-audit-data.ts` - Update format

Change from groups with generic titles to specific issues:

```typescript
export function createMockAuditData(domain: string) {
  return {
    issues: [
      {
        title: "Fix typo: 'suport' → 'support'",
        category: "typos",
        severity: "medium",
        impact: "Reduces credibility",
        fix: "Change 'suport' to 'support'",
        locations: [{ url: `${domain}/contact`, snippet: "Contact our suport team" }]
      },
      {
        title: "Pricing conflict: $29 vs $39",
        category: "factual",
        severity: "high",
        impact: "Confuses users about pricing",
        fix: "Standardize to one price",
        locations: [
          { url: `${domain}/pricing`, snippet: "Starting at $29/month" },
          { url: `${domain}/features`, snippet: "Plans start at $39/month" }
        ]
      },
      // ... more issues
    ],
    pagesScanned: 5,
    auditedUrls: [/* ... */]
  }
}
```

### `components/data-table.tsx` - Simplify UI

**DELETE**:
- Nested row complexity (`instances` rendering)
- Signature-based state lookups
- `issueStates` Map management
- `fetchIssueStates` useEffect
- Category column (if dropping category)

**SIMPLIFY**:
- Each row = one issue
- Status comes from issue row directly
- Actions update the issue row directly (PATCH `/api/audit/[id]/issues/[issueId]`)
- Expand to show locations (simple list, not nested table rows)
- Primary grouping: Severity tabs (High/Medium/Low)
- Optional: Category can be removed from UI, severity is more important

```tsx
// Simplified ExpandableRow
function ExpandableRow({ row }: { row: Row<AuditTableRow> }) {
  const [isOpen, setIsOpen] = useState(false)
  const locationCount = row.original.locations?.length || 0
  const isMultiLocation = locationCount > 1
  
  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {row.getVisibleCells().map((cell) => {
          // In the Issue/Title column, show location count badge for multi-location issues
          if (cell.column.id === 'title' && isMultiLocation) {
            return (
              <TableCell key={cell.id}>
                <div className="flex items-center gap-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  <Badge variant="secondary" className="text-xs">
                    {locationCount} pages
                  </Badge>
                  <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </TableCell>
            )
          }
          return <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
        })}
      </TableRow>
      {isOpen && isMultiLocation && (
        <TableRow>
          <TableCell colSpan={columns.length} className="bg-muted/30 pl-8">
            <ul className="space-y-2 py-2">
              {row.original.locations.map((loc, i) => (
                <li key={i} className="text-sm">
                  <span className="font-mono text-muted-foreground">{loc.url}</span>
                  <span className="ml-2 italic text-foreground/80">"{loc.snippet}"</span>
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
```

**Expandability logic**:
- **Always expandable** for multi-location issues (locations.length > 1)
- Show badge with count ("2 pages") and ▼ chevron indicator
- Single-location issues don't need expansion (all info in main row)
- Optional: Always expandable to show impact/fix/details even for single locations

### `types/fortress.ts` - Simplify types

**DELETE**:
- `AuditIssueInstance`
- `IssueStateRecord`
- `IssueState` (replace with `IssueStatus`)

**UPDATE**:
```typescript
export type IssueStatus = 'active' | 'ignored' | 'resolved'

export interface Issue {
  id: string
  audit_id: string
  title: string
  category?: string  // Optional - can remove if not using
  severity: 'low' | 'medium' | 'high'
  impact: string | null
  fix: string | null
  locations: Array<{ url: string; snippet: string }>
  status: IssueStatus
  created_at: string
  updated_at: string
}
```

---

## API Route Changes

### `app/api/audit/[id]/issues/[signature]/route.ts`

**Rename to**: `app/api/audit/[id]/issues/[issueId]/route.ts`

**Simplify**:
```typescript
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; issueId: string } }
) {
  // Auth check...
  
  const { status } = await request.json()
  
  // Update issue status directly
  const { data, error } = await supabaseAdmin
    .from('issues')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', issueId)
    .eq('audit_id', auditId)
    .select()
    .single()
  
  return NextResponse.json({ success: true, issue: data })
}
```

### `app/api/audit/route.ts` and `app/api/audit/poll/route.ts`

**Update** to save to `issues` table instead of `audit_issues`:

```typescript
// After parsing response
for (const issue of result.issues) {
  await supabaseAdmin.from('issues').insert({
    audit_id: runId,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    impact: issue.impact,
    fix: issue.fix,
    locations: issue.locations,
    status: 'active',
  })
}
```

### `app/api/audit/[id]/route.ts`

**Update** to fetch from `issues` table:

```typescript
// Fetch issues
const { data: issues } = await supabaseAdmin
  .from('issues')
  .select('*')
  .eq('audit_id', auditId)
  .order('severity', { ascending: false })

return NextResponse.json({
  ...audit,
  issues,
})
```

### `lib/audit-exporter.ts` - Update Export Functions

**Current**: Reads from `audit.issues_json.groups`
**New**: Reads from `issues` table (query when exporting) or pass issues array

```typescript
// Update to accept issues array instead of reading from issues_json
export function generateAuditMarkdown(audit: AuditRun, issues: Issue[]): string {
  // ... use issues array directly instead of issues_json.groups
  issues.forEach((issue, index) => {
    // ... format issue with locations array
  })
}

// Same for PDF and JSON exports
```

**Alternative**: Fetch issues in the export route, then pass to export functions:
```typescript
// In export route
const { data: issues } = await supabaseAdmin
  .from('issues')
  .select('*')
  .eq('audit_id', auditId)
  .order('severity', { ascending: false })

const markdown = generateAuditMarkdown(audit, issues)
```

---

## Migration Steps

### Phase 1: Database
1. Create new `issues` table
2. **DELETE all existing data** from `audit_issues` and `audit_issue_states` (pre-launch cleanup)
3. Keep old tables temporarily (will drop in Phase 3)

### Phase 2: Code
1. Update audit prompt
2. Update `parseAuditResponse` 
3. Update save logic to write to `issues` table
4. Update fetch logic to read from `issues` table
5. Simplify `data-table.tsx`
6. Simplify `health-score.ts`
7. Delete `issue-signature.ts`
8. Update types

### Phase 3: Cleanup
1. Drop `audit_issues` table
2. Drop `audit_issue_states` table
3. Delete migration scripts
4. Delete old docs

---

## Testing Checklist

- [ ] New audit creates issues in `issues` table
- [ ] Issues display in table (one row per issue)
- [ ] Multi-location issues expand to show all locations
- [ ] Ignore/resolve updates issue status directly
- [ ] Health score counts issues correctly
- [ ] Health score calculates critical pages from locations array
- [ ] Severity filtering works (primary grouping)
- [ ] Category filtering works (if keeping category)
- [ ] Search works across titles
- [ ] Export (PDF/JSON/Markdown) works with new format
- [ ] Old audit data cleaned up (tables empty or dropped)

---

## Summary of Deletions

### Files to Delete
- `lib/issue-signature.ts`
- `scripts/migrate-issues-to-instances.ts`
- `docs/INSTANCE_BASED_ISSUES_MIGRATION.md`

### Tables to Drop (after migration)
- `audit_issues`
- `audit_issue_states`

### Types to Drop (after migration)
- `issue_category_enum`
- `issue_severity_enum` (recreate as `issue_severity`)
- `issue_state_enum` (recreate as `issue_status`)

### Code to Simplify
- `lib/audit-table-adapter.ts` (~100 lines → ~30 lines)
- `lib/health-score.ts` (~400 lines → ~50 lines)
- `components/data-table.tsx` (remove nested row complexity)
- `lib/audit.ts` (update prompt and parsing)

---

## Benefits

1. **Simpler mental model**: Issue = action item
2. **Correct health score**: Counts what matters (issues, not instances)
3. **Simpler schema**: 1 table instead of 2+
4. **Simpler code**: ~500 lines removed
5. **Better UX**: Clear, actionable issue titles
6. **Easier state management**: Status on row, not separate table
7. **Clean slate**: Pre-launch data deletion ensures no legacy format issues

---

## Considerations & Decisions

### Category: Keep or Drop?

**Arguments for keeping**:
- Useful for filtering ("show me all typos")
- Helpful for analytics/reporting
- Model can easily provide it

**Arguments for dropping**:
- Severity is more important for prioritization
- Locations array shows where issues are
- Simpler schema (one less field)
- Can search titles instead of filtering by category

**Recommendation**: Make it **optional** in schema. Start without it in UI, add back if users request category filtering.

### Critical Pages Calculation

With locations array, we need to:
1. Extract unique page paths from all locations
2. Mark pages as critical if they have high-severity issues
3. This replaces the old instance-based calculation

See updated `health-score.ts` example above.

### Export Functions

Exports currently read from `issues_json`. Options:
1. Update to query `issues` table directly
2. Pass issues array from route handler to export functions
3. Keep reading from `issues_json` during transition (dual-write)

**Recommendation**: Option 1 or 2 - query/fetch issues table and pass to export functions.

### Missing "count" Field

Old format had `count` field (number of instances per group). New format:
- Locations array length = count of locations
- Can derive if needed: `issue.locations.length`

No separate count field needed.

---

## Additional Considerations & Potential Gaps

### 1. Search Functionality

**Current**: Search only searches `title`, `impact`, and `fix` fields.

**Gap**: Search doesn't include `locations` array (URLs and snippets). For multi-location issues, users might want to search by URL or snippet content.

**Decision needed**: 
- Option A: Keep current (title/impact/fix only) - simpler
- Option B: Expand search to include locations (search through JSONB array)
- Option C: Add separate URL/snippet search field

**Recommendation**: Start with Option A, add Option B if users request it.

**Implementation if needed**:
```typescript
// In searchFilteredData, expand to search locations
return filteredData.filter((row) => {
  const searchLower = globalFilter.toLowerCase()
  const matchesTitle = row.title.toLowerCase().includes(searchLower)
  const matchesImpact = row.impact?.toLowerCase().includes(searchLower)
  const matchesFix = row.fix?.toLowerCase().includes(searchLower)
  
  // Search locations array
  const matchesLocations = row.locations?.some(loc => 
    loc.url.toLowerCase().includes(searchLower) ||
    loc.snippet.toLowerCase().includes(searchLower)
  )
  
  return matchesTitle || matchesImpact || matchesFix || matchesLocations
})
```

### 2. Test Updates Required

**Breaking changes**: Existing tests will fail because they depend on:
- `generateIssueSignature()` function (being deleted)
- `audit_issue_states` table (being deleted)
- `AuditIssueInstance` type (being deleted)
- Mock data format (groups → issues)

**Action items**:
- Update `__tests__/database-storage.test.ts` to use new `issues` table and status column
- Update `__tests__/helpers/test-db.ts` mock data generators
- Remove signature-based state tests
- Add new tests for status column updates

### 3. Resume/Rerun Endpoints

**Files to check**: `app/api/audit/[id]/resume/route.ts`, `app/api/audit/[id]/rerun/route.ts`

**Gap**: These endpoints may need updates to work with new `issues` table format.

**Action**: Verify these endpoints write issues correctly when resuming/rerunning audits.

### 4. State Persistence Across Audits

**Question**: If the same issue appears in a new audit (same title, same locations), should we:
- A: Create new issue row with status='active' (fresh start)
- B: Preserve previous status from previous audit (continue state)
- C: Match by some identifier (title + locations hash?) to preserve state

**Current plan**: Option A - each audit is independent. Users can ignore/resolve issues in new audits.

**Future consideration**: Option C would require deduplication logic, which adds complexity. Keep it simple for now.

### 5. Model Output Validation

**Risk**: Model might not follow instructions correctly (groups issues despite prompt).

**Mitigation**: 
- Add validation in `parseAuditResponse` to catch grouped issues
- Log warnings when model groups point issues incorrectly
- Consider adding a post-processing step if needed (but prefer fixing prompt first)

**Validation example**:
```typescript
// Basic validation: ensure locations array exists
issues.forEach((issue, idx) => {
  if (!Array.isArray(issue.locations) || issue.locations.length === 0) {
    console.warn(`[Audit] Issue ${idx} missing locations:`, issue.title)
  }
})
```

### 6. Edge Cases & Data Validation

**Empty locations array**: 
- Should never happen (model should always provide at least 1 location)
- Add validation to reject issues with empty locations
- Add database constraint if needed: `CHECK (jsonb_array_length(locations) > 0)`

**Invalid URLs**:
- Health score already handles this (try/catch around URL parsing)
- UI should handle gracefully (show URL as-is if invalid)

**Missing required fields**:
- Database constraints ensure `title`, `severity`, `locations` exist
- Application validation in `parseAuditResponse` before saving

### 7. JSONB Query Performance

**Consideration**: Querying/filtering by JSONB `locations` array can be slower than relational queries.

**Impact**: 
- Search across locations (if implemented) might be slower
- Critical pages calculation loops through all issues (O(n) with n=issues, not instances)
- Should be fine for typical audit sizes (< 100 issues)

**Mitigation**: If performance becomes an issue, can add computed columns or indexes:
```sql
-- Future optimization if needed
ALTER TABLE issues ADD COLUMN location_urls TEXT[];
CREATE INDEX idx_issues_location_urls ON issues USING GIN (location_urls);
```

### 8. RLS Policy Verification

**Action**: Verify RLS policy works correctly with new table structure.

**Test**: 
- User A can only see issues from their own audits
- User A cannot see issues from User B's audits
- Unauthenticated users cannot access issues table

The policy in the doc should work, but verify in staging.

### 9. Dual-Write Period (Optional)

**Question**: Should we dual-write during transition (write to both old and new tables)?

**Current plan**: Clean break - delete old data, start fresh.

**Alternative**: Keep `issues_json` as backup during initial rollout:
- Write to `issues` table (primary)
- Also write to `issues_json` (backup)
- Remove `issues_json` writing after verification period

**Recommendation**: Clean break is simpler since pre-launch, but dual-write is safer if you want a rollback option.

### 10. Export Format Compatibility

**Consideration**: Exports need to match expected format for external integrations.

**Action**: 
- Verify JSON export structure matches any expected schema
- Check if external tools/scripts depend on specific field names
- Update export documentation if format changes

### 11. Migration Order (Critical)

**Important**: Migration steps must be done in correct order to avoid breaking production:

1. **Create new table** (non-breaking, old code still works)
2. **Update code to write to new table** (dual-write if cautious, or clean break)
3. **Update code to read from new table** (breaking if done before step 2)
4. **Delete old tables** (only after verification)

**Recommendation**: Follow the 3-phase approach in doc, but be careful about step order.

### 12. Category Decision Timeline

**Question**: If we make category optional but don't use it initially, when do we decide?

**Recommendation**: 
- Start without category in UI (simpler)
- Monitor user feedback for category filtering requests
- Can add category column/UI later without breaking changes (already nullable in schema)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Model doesn't follow prompt | Medium | Medium | Validation + logging, prompt iteration |
| Tests break during migration | High | Low | Update tests as part of Phase 2 |
| Performance issues with JSONB | Low | Medium | Add indexes if needed, typical audits small |
| Search doesn't find location content | Medium | Low | Add location search if users request |
| State persistence confusion | Low | Low | Each audit independent (clear UX) |
| Export format incompatibility | Low | High | Verify exports match expected format |

---

## Pre-Implementation Checklist

Before starting implementation, verify:

- [ ] All team members understand new mental model (issue = action item)
- [ ] Decision made on category (keep optional or remove entirely)
- [ ] Decision made on search scope (titles only or include locations)
- [ ] Decision made on dual-write vs clean break
- [ ] Test plan updated to reflect new structure
- [ ] Export format verified with any external dependencies
- [ ] Backup plan if migration fails (can rollback to old tables during Phase 1-2)

