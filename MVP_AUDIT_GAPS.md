# Content Audit MVP - Gap Analysis

## Completed ✅
- Updated homepage H1/H2 with new content and styling
- Limit unauthenticated users to 2 clickable issues on homepage
- Add title field to brand_audit_runs table (migration)
- Create audit detail page (/dashboard/audit/[id])
- Update dashboard to link to detail page instead of showing all issues inline
- Update API to save title when creating audit

## Remaining Gaps

### 1. Brand Name Extraction (Refinement)
- Current implementation uses simple domain parsing (fortress.app -> Fortress)
- Could be improved with better heuristics or external data

### 2. Audit Title Input
- No UI for users to set audit title when creating
- Currently defaults to `{BrandName} Audit`

### 3. Dashboard Display Refinement
- No way to edit/rename audit after creation
- No filtering/search by title or brand name

### 4. Issue Opening Tracking (Persistence)
- Currently `viewedIssues` is state-only (resets on refresh)
- Should persist to localStorage to prevent "refresh to reset" bypass
