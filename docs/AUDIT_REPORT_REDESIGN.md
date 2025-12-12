# Audit Report Redesign - Analysis & Recommendations

## JSON Structure from AI Model

Based on the audit schema (`lib/audit.ts`), the model returns:

```typescript
{
  groups: [
    {
      title: string,              // Issue title/description
      severity: "low" | "medium" | "high",
      impact: string,             // Business impact description
      fix: string,                // Recommended action
      examples: [
        {
          url: string,            // Page URL where issue found
          snippet: string         // Exact text snippet showing issue
        }
      ],
      count: number               // Number of instances found
    }
  ],
  pagesScanned: number,
  auditedUrls: string[]
}
```

### Additional Metadata (from API response)
- `runId`: string (UUID)
- `domain`: string
- `totalIssues`: number
- `preview`: boolean (true for free/unauthenticated)
- `meta.pagesScanned`: number
- `meta.auditedUrls`: string[]
- `meta.tier`: "FREE" | "PAID" | "ENTERPRISE"
- `meta.createdAt`: ISO timestamp

---

## Design System Components Available

✅ **Components we have:**
- `Accordion` - For collapsible issue lists
- `Collapsible` - Alternative expand/collapse
- `Card` - Issue containers
- `Badge` - Severity indicators
- `Alert` - Error/warning states
- `Table` - For structured data display
- `Button` - Actions (ignore, resolve, etc.)
- `Tabs` - For grouping (All/High/Medium/Low)
- `Progress` - For scan progress
- `Dialog` - For confirmations

---

## Design Recommendations

### Option 1: Accordion-Based Layout (Recommended)
**Best for:** Clean, scannable list with inline details

**Structure:**
```
┌─────────────────────────────────────────┐
│  Summary Stats (Cards)                  │
│  [Total Issues] [Pages] [Date]          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Filters/Tabs: All | High | Medium | Low│
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ▼ Inconsistent Product Name             │
│   [High] • 5 instances                  │
│   Impact: Confuses users...             │
│   Evidence: 3 examples                  │
│   Fix: Standardize to...                │
│   [Ignore] [Mark Resolved]              │
├─────────────────────────────────────────┤
│ ▶ Grammar Error on Pricing Page         │
│   [Medium] • 2 instances                │
└─────────────────────────────────────────┘
```

**Pros:**
- All issues visible at once (good for scanning)
- Inline details (no separate detail view)
- Works well with ignore/resolve actions
- Matches design system (Accordion component)

**Cons:**
- Can get long with many issues
- Less space for detailed evidence

---

### Option 2: Two-Column Master-Detail (Current)
**Best for:** Detailed evidence review

**Structure:**
```
┌─────────────┬──────────────────────────┐
│ Issue List  │ Issue Detail             │
│             │                          │
│ • High      │ Title: Inconsistent...   │
│ • Medium    │ Severity: High           │
│ • Low       │ Impact: ...              │
│             │ Evidence:                │
│             │   "Snippet 1"            │
│             │   URL: example.com/p1    │
│             │ Recommendation: ...      │
│             │ [Ignore] [Resolve]       │
└─────────────┴──────────────────────────┘
```

**Pros:**
- More space for detailed evidence
- Better for reading full snippets
- Familiar pattern

**Cons:**
- Requires clicking to see details
- Two-column can be cramped on mobile
- More complex state management

---

### Option 3: Card Grid with Modals
**Best for:** Visual, card-based layout

**Structure:**
```
┌──────────────┬──────────────┬──────────┐
│ [Card]       │ [Card]       │ [Card]   │
│ High         │ Medium       │ Low      │
│ Title        │ Title        │ Title    │
│ 5 instances  │ 2 instances  │ 1 inst.  │
│ [View]       │ [View]       │ [View]   │
└──────────────┴──────────────┴──────────┘
```

**Pros:**
- Visual, modern layout
- Good for mobile

**Cons:**
- Modal interrupts flow
- Less information density
- More clicks to scan all issues

---

## Recommended Approach: **Accordion-Based with Tabs**

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│  Audit Summary (Header)                         │
│  Domain: example.com                            │
│  Scanned: 12 pages • 8 issues • Dec 11, 2025   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  [All Issues] [High] [Medium] [Low] [Ignored]  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ▼ Inconsistent Product Name              [High] │
│   Impact: Confuses users about identity         │
│   5 instances found across 3 pages              │
│                                                  │
│   Evidence:                                      │
│   • "ProductName Pro" (example.com/pricing)     │
│   • "Product-Name Plus" (example.com/features)  │
│                                                  │
│   Recommendation:                                │
│   Standardize to 'ProductName' across all...    │
│                                                  │
│   [Ignore Issue] [Mark as Resolved]             │
├─────────────────────────────────────────────────┤
│ ▶ Grammar Error on Homepage              [Med]  │
│   2 instances                                   │
└─────────────────────────────────────────────────┘
```

### Key Features

1. **Tabs for Filtering**
   - All Issues (default)
   - High Severity
   - Medium Severity
   - Low Severity
   - Ignored (collapsed, can restore)
   - Resolved (collapsed, can reactivate)

2. **Accordion Items**
   - Each issue is an accordion item
   - Expand to see full details
   - Collapse to scan quickly
   - Visual severity indicator (Badge)

3. **Action Buttons**
   - Ignore (moves to ignored tab, disappears from active)
   - Resolve (moves to resolved tab)
   - Restore (for ignored/resolved items)

4. **Evidence Display**
   - List of examples with snippets
   - URLs as clickable links
   - Truncate long snippets with expand

---

## Component Recommendations

### From Design System
- ✅ `Accordion` - For expandable issue list
- ✅ `Tabs` - For severity filtering
- ✅ `Badge` - Severity indicators (high/medium/low)
- ✅ `Card` - Optional wrapper for summary stats
- ✅ `Button` - Action buttons (ignore, resolve)
- ✅ `Alert` - For empty states ("No issues found")
- ✅ `Separator` - Between accordion items

### Custom Components Needed
- `IssueAccordionItem` - Wrapper around AccordionItem
  - Severity badge
  - Impact summary
  - Evidence list
  - Action buttons
- `EvidenceSnippet` - Display URL + snippet
  - Truncation logic
  - Link to URL
  - Copy snippet button

---

## Ignore/Resolve Functionality

### Data Structure (Future - Phase 4)

Store issue state in `brand_audit_runs.issues_json`:

```json
{
  "groups": [...],
  "issueStates": {
    "issue-signature-hash": "active" | "ignored" | "resolved"
  }
}
```

**Issue Signature Generation:**
```typescript
function generateIssueSignature(issue: IssueGroup): string {
  // Use: page_url + issue_type + normalized_text
  const normalized = normalizeText(issue.title)
  return hash(`${issue.examples[0].url}-${normalized}`)
}
```

### UI Behavior

1. **Ignore Button**
   - Click → Confirmation dialog → Move to "Ignored" tab
   - Hide from active list
   - Can restore from Ignored tab

2. **Resolve Button**
   - Click → Mark as resolved
   - Move to "Resolved" tab
   - Can reactivate if issue resurfaces

3. **Filtered Tabs**
   - Active tab: Shows only `active` issues
   - Ignored tab: Shows ignored issues (collapsed by default)
   - Resolved tab: Shows resolved issues (collapsed)

---

## Implementation Plan

### Step 1: Create New Component Structure
```
components/
  audit/
    AuditReport.tsx           # Main wrapper
    IssueAccordion.tsx        # Accordion-based issue list
    IssueItem.tsx             # Individual issue accordion item
    EvidenceList.tsx          # List of evidence snippets
    EvidenceSnippet.tsx       # Single snippet display
    AuditSummary.tsx          # Header with stats
    IssueFilters.tsx          # Tabs for filtering
```

### Step 2: State Management
- Use React state for ignore/resolve (local first)
- Store in `issues_json.issueStates` (Phase 4 - DB persistence)
- Filter issues based on active tab + state

### Step 3: Design System Integration
- Apply typography (serif headlines, sans-serif body)
- Use spacing tokens (multiples of 8px)
- Match color palette (neutral, minimal saturation)
- Use Badge for severity

### Step 4: Responsive Design
- Stack accordion on mobile (single column)
- Collapse tabs on mobile (dropdown select)
- Touch-friendly action buttons

---

## Template/Library Recommendations

### Recommended: Build Custom with Design System
**Why:** You already have all the components (shadcn/ui). Building custom ensures:
- Perfect design system compliance
- Full control over ignore/resolve UX
- Optimized for your specific data structure
- No extra dependencies

### Alternative: Consider These Patterns

1. **React-Admin List Pattern**
   - Good reference for filterable lists
   - But too heavy for our needs

2. **GitHub Issues UI**
   - Tabs (Open/Closed)
   - Labels (severity = badges)
   - Expandable details
   - Good inspiration for layout

3. **Linear's Issue Tracker**
   - Clean accordion-based lists
   - Good status/state management
   - Modern, minimal design

---

## Next Steps

1. ✅ Document JSON structure (done above)
2. Create `components/audit/` directory structure
3. Build `AuditReport` component using Accordion
4. Add ignore/resolve buttons (UI only first)
5. Add filtering tabs (All/High/Medium/Low)
6. Test with real audit data
7. Apply design system styling
8. Make responsive
9. Implement Phase 4 DB persistence later

---

## Design System Compliance Checklist

- [ ] Serif fonts for headings (`font-serif`)
- [ ] Sans-serif for body text
- [ ] Spacing in multiples of 8px (16px, 24px, 32px)
- [ ] Zero border radius (straight edges)
- [ ] Neutral color palette (minimal saturation)
- [ ] Typographic hierarchy (scale: 6xl, 4xl, 2xl, base)
- [ ] Generous whitespace
- [ ] Use Badge component for severity
- [ ] Use Card component for containers
- [ ] Use Alert for empty states

