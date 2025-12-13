# One‑Click Website Content Audit SaaS

## Feature Comparison by Plan

| Feature | Free (Unauthenticated) | Free (Authenticated) | Paid | Enterprise |
|---------|----------------------|---------------------|------|------------|
| **Audit Engine** |
| Model | `o4-mini-deep-research` | `o4-mini-deep-research` | `o3-deep-research` | `o3-deep-research` |
| Max Tool Calls | 5 | 5 | 25 | 100 |
| Execution Mode | Synchronous | Synchronous | Background | Background (default) |
| Timeout | ~90 seconds | ~90 seconds | Up to 1 hour | Up to 1 hour |
| **Page Coverage** |
| Pages Analyzed | 3 pages (homepage + 2 key) | 3 pages (homepage + 2 key) | 10-20 important pages | Full-site analysis |
| Page Selection | Homepage + pricing/about/features | Homepage + pricing/about/features | Homepage, pricing, features, about, key product pages | All pages |
| **Issue Detection** |
| Issue Categories | High-signal only | High-signal only | All categories | All categories + custom |
| Typos & Spelling | ✅ | ✅ | ✅ | ✅ |
| Grammar Errors | ✅ | ✅ | ✅ | ✅ |
| Punctuation Errors | ✅ | ✅ | ✅ | ✅ |
| Factual Contradictions | ✅ | ✅ | ✅ | ✅ |
| Inconsistent Terminology | ✅ | ✅ | ✅ | ✅ |
| Brand/Product Name Inconsistencies | ✅ | ✅ | ✅ | ✅ |
| Duplicate Content Conflicts | ✅ | ✅ | ✅ | ✅ |
| Competitor Analysis | ❌ | ❌ | ❌ | ✅ |
| Custom Audit Requests | ❌ | ❌ | ❌ | ✅ |
| Broken Links Detection | ❌ | ❌ | ❌ | ✅ |
| IA/Taxonomy Recommendations | ❌ | ❌ | ❌ | ✅ |
| **Issue Management** |
| Issue Suppression | ❌ | ❌ | ✅ | ✅ |
| Issue Lifecycle (Active/Ignored/Resolved) | ❌ | ❌ | ✅ | ✅ |
| Stable Issue Signatures | ❌ | ❌ | ✅ | ✅ |
| Issue History Tracking | ❌ | ❌ | ✅ | ✅ |
| **Results & Reporting** |
| Issues Shown | 3 (preview with fade-out) | All issues from mini audit | All issues | All issues |
| Export Format | None | None | PDF, JSON, Markdown | PDF, JSON, Markdown |
| Markdown Export | ❌ | ❌ | ✅ (with AI prompt header) | ✅ (with AI prompt header) |
| Historical Reports | ❌ | ✅ (limited) | ✅ (30/60/90 days) | ✅ (unlimited) |
| Health Score | ❌ | ❌ | ✅ | ✅ |
| **Monitoring** |
| Continuous Monitoring | ❌ | ❌ | ✅ (Weekly digest) | ✅ (Real-time alerts) |
| Page Change Detection | ❌ | ❌ | ✅ | ✅ |
| Weekly Digest | ❌ | ❌ | ✅ | ✅ |
| Real-time Alerts | ❌ | ❌ | ❌ | ✅ (Slack/Email/Webhook) |
| Page Fingerprinting | ❌ | ❌ | ✅ | ✅ |
| **Storage & Access** |
| Audit Storage | Local (session token) | Supabase (user account) | Supabase (user account) | Supabase (team account) |
| Claim Later | ✅ (via session token) | N/A | N/A | N/A |
| Audit History | ❌ | ✅ | ✅ | ✅ |
| Team Sharing | ❌ | ❌ | ❌ | ✅ |
| **API & Integration** |
| API Access | Limited | Limited | Full | Full + webhooks |
| Background Polling | ❌ | ❌ | ✅ | ✅ |
| Webhook Support | ❌ | ❌ | ❌ | ✅ |
| **Support** |
| Support Level | Community | Community | Email | Priority + dedicated |

---

## North Star

Deliver a trustworthy, low‑noise content QA audit (copy + facts + links) that teams can track over time, suppress known issues, and monitor for regressions.

## Core principles

* Content only by default (no UI/layout speculation)
* Minimize false positives (especially breakpoint duplicates + markdown spacing artifacts)

* Every issue is actionable: exact text, suggested fix, URL, evidence
* Everything is trackable over time: found, ignored, resolved, resurfaced

---

## Problem to solve

False positives from crawler output:

* Responsive breakpoint duplication (desktop vs mobile blocks look like duplicate content)
* Markdown/HTML linearization makes headings look “stuck” to paragraphs
* Model invents UI/spacing issues from text‑only input

## Key solution

Use **Deep Research as the primary analysis engine**

* Deep Research handles multi-page synthesis, fact-checking, competitor comparison, and long-form reporting.

* Deep Research is the authoritative layer for issue detection, deltas, citations, and historical comparison.

---

## Roadmap — Deep Research–Powered Audit Platform

### Phase 1: Core Deep Research Architecture ✅ COMPLETED

* ✅ Adopt **Deep Research as the primary analysis engine** for all audits.
* ✅ Use background execution for long-running tasks.
* ✅ Use tool calls (web search + browse) for live verification and citations.
* ✅ Support large, citation-backed reports.

**Domain-first approach**

1. Pass top-level domain to Deep Research agent (e.g., `example.com`).
2. Agent auto-crawls and analyzes multiple pages (up to plan limit) without needing preselected URLs.
3. Agent synthesizes all issues across crawled pages into a single site-wide audit.
4. Results include all audited URLs and grouped issues with citations.

Rationale:

* Deep Research tasks are self-contained and long-running.
* OpenAI expects developers to orchestrate multi-task research workflows.

---

### Phase 2: Progress Tracking + Auto-Claim ✅ COMPLETED

* ✅ Resume failed or interrupted audits (for background jobs).
* ✅ Enterprise UX primitives:

  * ✅ "Audit in progress" status display
  * ✅ Progress tracking with pages scanned and issues found
  * ✅ Real-time polling every 5 seconds for in-progress audits

* ✅ Auto-claim unauthenticated audits on signup:
  * ✅ Store `sessionToken` in localStorage as `audit_session_token` when unauthenticated audit completes.
  * ✅ On dashboard load (after auth), check localStorage for `audit_session_token`.
  * ✅ If found, automatically call `/api/audit/claim` to transfer ownership.
  * ✅ Clear localStorage after successful claim.
  * ✅ Fallback to `pendingAudit` for backward compatibility.
  * ✅ This ensures seamless UX: users see their mini audit in dashboard immediately after signup.

App owns global state. Deep Research does not.

---

### Phase 3: Freemium + Cost Control ✅ COMPLETED

**Free (unauth / teaser)**

* ✅ Limit via `max_tool_calls: 5`.
* ✅ Fast, shallow audit (~90s timeout).
* ✅ High-signal issues only.
* ✅ Show only 3 issues with fade-out to encourage signup.

**Paid**

* ✅ `max_tool_calls: 25`.
* ✅ Deeper page coverage.
* ✅ Background execution.

**Enterprise**

* ✅ `max_tool_calls: 100`.
* ✅ Full-site analysis.
* ✅ Background mode by default.

Benefits:

* Predictable cost.
* Predictable time to value.
* Clear upgrade path.

---

### Phase 3.5: Export & Reporting Formats ✅ COMPLETED

**Export formats for paid users only**

* ✅ Exports are not available for free (authenticated or unauthenticated) users.
* ✅ PDF export - Formatted report suitable for sharing with stakeholders.
  * ✅ Uses Puppeteer for HTML to PDF conversion
  * ✅ Includes cover page, summary, and formatted issue details
  * ✅ 45-second timeout with proper error handling
* ✅ JSON export - Machine-readable format for integrations and automation.
  * ✅ Matches API response schema
  * ✅ Includes all metadata (domain, tier, dates, etc.)
* ✅ Markdown export - Includes AI prompt header for direct use in AI-assisted IDEs (Cursor, GitHub Copilot, etc.).
  * ✅ Users can drop the entire markdown file into their IDE and use AI to resolve all issues.
  * ✅ Prompt header guides AI to understand issue structure and provide fixes.

**Implementation requirements**

* ✅ Generate PDF with proper formatting (tables, issue grouping, severity indicators).
* ✅ JSON export matches API response schema.
* ✅ Markdown export includes:
  * ✅ Header with AI prompt explaining audit structure.
  * ✅ Structured issue list with URLs, snippets, and suggested fixes.
  * ✅ Format optimized for AI consumption (clear instructions, structured data).
* ✅ Export UI in audit detail page (gated to paid users only).
* ✅ Monitoring and logging for export failures via PostHog.
* ✅ Filename format: `{domain}-audit-{date}.{ext}`

---

### Phase 3.7: Testing + Design System Redesign

**Testing Requirements**

**Priority: Test non-AI components first using mock data to avoid expensive model calls.**

**Non-AI Testing (Use Mock Data):**

**Database & Storage Testing:** ✅ COMPLETE
- ✅ Test database storage (unauthenticated saves with session_token, authenticated saves with user_id)
- ✅ Test database retrieval (RLS policies, user isolation, session token lookup)
- ✅ Test session token expiry (24h window, cleanup of expired tokens)
- ✅ Test concurrent claims (multiple users, same token edge cases)
- ✅ Test audit result storage/retrieval with mock audit data (no model calls)
- ✅ Test issue state persistence (active/ignored/resolved) with mock data
- ✅ Test audit history retrieval and pagination
- ✅ All 14 tests passing in `__tests__/database-storage.test.ts`

**API Endpoints Testing (Mock Audit Data):** ✅ COMPLETE
- ✅ Test `/api/audit` endpoint with mock response (skip actual model calls)
- ✅ Test `/api/audit/[id]` retrieval with stored mock data
- ✅ Test `/api/audit/[id]/export` with mock audit results (PDF, JSON, Markdown)
- ✅ Test `/api/audit/claim` with mock session tokens
- ✅ Test `/api/audit/poll` with mock in-progress states
- ✅ Test API error handling (network errors, 500s, malformed responses)
- ✅ Test malformed domain input validation (invalid URLs, edge cases)
- ✅ All 22 tests passing in `__tests__/api-endpoints.test.ts` (direct route handler testing)
- ✅ All 6 tests passing in `__tests__/api-endpoints-server.test.ts` (dev server integration testing)
- ✅ Fixed URL normalization to use `url.origin` for consistent domain format across audits

**Auth & User Flow Testing:**
- Test signup flow (email → magic link → dashboard)
- Test auto-claim on dashboard load (localStorage → API call → DB update)
- Test unauthenticated → authenticated flow (mock audit → signup → auto-claim)
- Test authenticated free tier (mock audit with account storage)
- Test user plan verification and gating

**Stripe Payment Testing:**
- Test checkout flow (button click → Stripe session → redirect)
- Test payment success (webhook → plan update → redirect to success page)
- Test payment cancel (redirect to cancel page, no plan change)
- Test webhook reliability (retry logic, idempotency, error handling)
- Test plan activation (verify profile.plan updates correctly)
- Test redirects (success_url, cancel_url, return_url)

**UI & Display Testing (Mock Data):**
- Test homepage flow with mock audit results (results display, session token storage)
- Test dashboard audit list display with mock audits
- Test audit detail page with mock data (table display, expandable rows)
- Test export UI (dropdown menu, loading states, error handling)
- Test export formats with mock data (PDF formatting, JSON schema, Markdown structure)
- Test export gating (free users see upgrade prompt, paid users can export)
- Test progress polling UI with mock in-progress states
- Test empty audit results display
- Test very large audits display (many issues, pagination)
- Test severity filtering tabs with mock data
- Test issue state filtering (active/ignored/resolved) with mock data

**AI Model Testing (Expensive - Do Later):**
- Test mini audit via API (curl or Postman - happy path, error cases, timeout)
- Test mini audit via UI (actual model calls)
- Test full audit with background execution
- Test model timeout handling
- Test model error recovery
- Test different tier configurations (FREE/PAID/ENTERPRISE model selection)
- Test tool call limits and enforcement

**Mock Data Strategy:**
- Generate mock audit results matching API response schema (`groups`, `meta`, `totalIssues`, etc.)
- Store mock audits in test database with various states (completed, in_progress, failed)
- Use mock data for all UI, API, and database testing to avoid model costs
- Create test fixtures for different scenarios (empty results, many issues, various severities)
- Mock issue states (active/ignored/resolved) for lifecycle testing
- Only use actual model calls for final integration testing after non-AI components are verified

**Design System Redesign** ✅ COMPLETE

**Homepage Redesign:** ✅ COMPLETE
- ✅ Apply design system typography (serif headlines, sans-serif body)
- ✅ Use design system spacing (multiples of 8px, generous whitespace)
- ✅ Apply design system components (Button, Input, Card, Alert)
- ✅ Match design system color palette (neutral, minimal saturation)
- ✅ Use design system principles (clarity, generous spacing, typographic hierarchy)
- ✅ Replace custom styles with design system tokens

**Audit Results Display:** ✅ COMPLETE (Audit Detail Page removed, table displayed on homepage and dashboard)
- ✅ Apply design system to audit results display (DataTable component)
- ✅ Design system components used throughout (Button, Card, Badge, Alert)
- ✅ Use Interstitial Loader for audit loading states
- ✅ Apply consistent error states using Alert components
- ✅ Match design system spacing and typography (zero border radius, serif headings, 8px spacing)
- ✅ Design system styling applied to all table components

**Loading & Error States:** ✅ COMPLETE
- ✅ Use Interstitial Loader component for blocking operations (homepage audit loading)
- ✅ Use Alert components for error messages consistently (replaced toast errors with Alert)
- ✅ Keep toast notifications for success messages
- ✅ Progress indicators use design system styling

**Implementation requirements:** ✅ COMPLETE
- ✅ Review all pages against design system reference (`/design-system`)
- ✅ Replace custom styles with design system components
- ✅ Ensure consistent spacing, typography, and color usage
- ✅ Design system components are responsive
- ✅ Accessibility verified (keyboard navigation, ARIA labels, screen reader support)

---

### Phase 3.6: OpenAI Batch Processing for Cost Optimization

**Automated audit cost reduction**

* Use OpenAI Batch API for scheduled/automated audits (weekly digests, monitoring scans).
* Batch processing provides 50% cost reduction for non-urgent audit jobs.
* Queue audits during off-peak hours for batch processing.
* Maintain real-time audits for user-initiated requests.

**Implementation**

* Detect scheduled vs user-initiated audits.
* Route scheduled audits to batch queue.
* Process batches daily during low-cost windows.
* Notify users when batch results are ready.
* Maintain audit history and tracking regardless of processing method.

**Benefits**

* Significant cost savings for monitoring and scheduled scans.
* Better resource utilization (batch during off-peak).
* Transparent to users (same results, lower cost).

---

### Phase 4: Issue Suppression + Lifecycle Management ✅ COMPLETE

**Stable Issue Signature (SIS)** ✅ COMPLETE

* ✅ signature = hash(page_url + issue_type + normalized_issue_text) - Implemented in `lib/issue-signature.ts`
* ✅ SHA256 hash generation with normalized text

**States** ✅ COMPLETE

* ✅ Active
* ✅ Ignored (suppressed)
* ✅ Resolved
* ✅ Database table `audit_issue_states` with user_id, domain, signature, state
* ✅ API endpoint `/api/audit/[id]/issues/[signature]` for state updates
* ✅ UI actions dropdown (Ignore, Resolve, Restore) in table

**Behavior** ✅ COMPLETE

* ✅ Ignored issues never resurface - Filtered out in `/api/audit` and `/api/audit/poll` endpoints
* ✅ Restoring an issue simply removes suppression - Restore action sets state to 'active'
* ✅ State filtering tabs (All/Active/Ignored/Resolved) in dashboard
* ✅ Matches enterprise QA tooling expectations

---

### Phase 5: Monitoring — Alerts vs Digests

**Shared foundation: Page fingerprinting**

* ❌ Store ETag (if available) - Not implemented (no schema columns)
* ❌ Store SHA256 hash of sanitized HTML - Not implemented (no schema columns)
* ❌ Store last scanned timestamp - Not implemented (no per-page tracking)
* ⚠️ Note: `created_at` exists on `brand_audit_runs` but only tracks audit creation time, not per-page scanning

**Schema status:** No database table or columns exist for page fingerprinting. Would need new table (e.g., `page_fingerprints`) with columns: `url`, `domain`, `etag`, `content_hash`, `last_scanned`.

If hash changes → page changed.

**Paid tier: Weekly digest**

* ❌ Weekly delta scan of changed + new pages - Not implemented
* ❌ Summarize:

  * ❌ New issues
  * ❌ Resolved issues
  * ❌ Major changes

**Enterprise tier: Alert on change**

* ❌ Detect page change - Not implemented
* ❌ Run targeted Deep Research diff on that page only - Not implemented
* ❌ Alert via Slack / email / webhook - Not implemented

---

### Phase 6: Health Score + History (Retention Engine)

**Live chart inputs**

* ❌ Total issues - Not calculated/displayed
* ❌ Severity-weighted unresolved count - Not calculated
* ❌ Critical page impact - Not calculated
* ✅ User actions (ignored / resolved) - Actions exist but not used in score calculation

**Example formula**

* ❌ Start at 100 - Not implemented
* ❌ Subtract: minor×1, medium×3, major×7 - Not implemented
* ❌ Subtract: critical_pages_with_errors×10 - Not implemented
* ❌ Add: resolved_last_7_days×2 - Not implemented

**Visuals**

* ❌ Score over time (30 / 60 / 90 days) - Not implemented
* ⚠️ Issue breakdown by severity - Shown in dashboard list but not as chart
* ❌ Ignored vs active ratio - Not implemented
* ❌ Pages with highest issue density - Not implemented

**Note:** Chart components exist (`components/chart-area-interactive.tsx`) but not used for health score. Notebook mentions health score should not count ignored issues.

---

### Phase 7: High-Value Paid Expansions

**Enterprise audit prompt**

* Create separate `ENTERPRISE_AUDIT_PROMPT` that extends base prompt with enterprise-only categories.
* Include instructions for:
  * Competitor analysis and comparison
  * Custom audit request handling
  * Broken link detection
  * IA/taxonomy recommendations
* Maintain same structure as base prompt for consistency.
* Use conditional prompt selection based on tier in `auditSite()` function.

**Competitor analysis**

* Feature & capability claims comparison.
* Pricing inconsistencies.
* Conflicting numbers / facts.
* Missing claims vs category norms.
* Security, compliance, AI, integrations.

**Custom audit requests**

* Legacy systems / deprecated products.
* Old brand names or pricing tiers.
* Legal & compliance risks.
* Competitor references.
* Outdated UI terminology or screenshots.
* Security-sensitive disclosures.
* Accessibility issues (non-visual).
* Brand drift (naming, capitalization).

**Broken links**

* Crawl links per page.
* Detect 404s, 500s, redirect loops.
* Report URL, anchor text, source page, status.

**IA / taxonomy recommendations**

* Detect duplicated concepts across pages.
* Identify orphaned or miscategorized pages.
* Suggest new hub pages.
* Propose unified product naming.
* Output improved sitemap and taxonomy.

---

### Outcome

The product evolves from a one-off audit tool into a:

* Content quality dashboard
* Continuous monitoring system
* Cleanup workflow
* Executive reporting layer

This is what makes it subscription-worthy and enterprise-grade.

---

## Implementation Details

### API Architecture

Two audit functions in `/lib/audit.ts`:

**`miniAudit(domain)`**
- For free/unauthenticated users
- Uses `o4-mini-deep-research` with `web_search_preview` tool
- Limited to 5 tool calls via `max_tool_calls` parameter
- Fast execution (~90s timeout)
- Returns high-signal issues only

**`auditSite(domain, tier)`**
- For paid/enterprise users
- Uses `o3-deep-research` model with `web_search_preview` tool
- Auto-crawls domain up to tier limit (controlled by `max_tool_calls`)
- Background execution for long-running audits
- Supports polling via `pollAuditStatus(responseId)`

### Tier Configuration

```typescript
AUDIT_TIERS = {
  FREE: { maxToolCalls: 5, background: false, model: "o4-mini-deep-research" },
  PAID: { maxToolCalls: 25, background: true, model: "o3-deep-research" },
  ENTERPRISE: { maxToolCalls: 100, background: true, model: "o3-deep-research" },
}
```

### API Endpoints

**POST `/api/audit`**
- Request: `{ domain: "example.com" }`
- Returns: `{ runId, status, groups, totalIssues, meta }`
- Automatically selects mini vs full audit based on user plan

**POST `/api/audit/poll`** (for background audits)
- Request: `{ responseId, runId }`
- Returns: completed results or `{ status: "in_progress" }`

### Response Schema

```json
{
  "groups": [
    {
      "title": "Inconsistent Product Name",
      "severity": "high",
      "impact": "Confuses users about product identity",
      "fix": "Standardize to 'ProductName' across all pages",
      "examples": [
        { "url": "https://example.com/pricing", "snippet": "ProductName Pro" },
        { "url": "https://example.com/features", "snippet": "Product-Name Plus" }
      ],
      "count": 5
    }
  ],
  "pagesScanned": 12,
  "auditedUrls": ["https://example.com", "https://example.com/pricing", ...]
}
```

### Key Behaviors

- ✅ Domain-first: Pass `example.com`, agent auto-crawls without preselected URLs
- ✅ Tier limits enforced via `max_tool_calls` parameter (cost control)
- ✅ Background mode for paid/enterprise tiers (handles "queued" and "in_progress" states)
- ✅ Results saved to Supabase (`brand_audit_runs` table)
- ✅ Unauthenticated audits get session tokens for later claim
- ✅ Both audit types use deep research models (o4-mini for free, o3 for paid)
