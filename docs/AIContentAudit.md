# One‑Click Website Content Audit SaaS

## Feature Comparison by Plan

| Feature | Free | Paid | Enterprise |
|---------|------|------|------------|
| **Audit Limits** |
| Domains | 1 | 5 | Unlimited |
| Audits per day | 1 per domain | 1 per domain | Unlimited |
| **Page Coverage** |
| Pages Analyzed | 2 pages (homepage + 1 key) | 10-20 important pages | Full-site analysis |
| **Issue Detection** |
| All Categories | ✅ | ✅ | ✅ |
| Competitor Analysis | ❌ | ❌ | ✅ |
| Custom Audit Requests | ❌ | ❌ | ✅ |
| IA/Taxonomy Recommendations | ❌ | ❌ | ✅ |
| **Issue Management** |
| Issue Lifecycle (Active/Ignored/Resolved) | ✅ | ✅ | ✅ |
| **Results & Reporting** |
| Export Formats | PDF, JSON, Markdown | PDF, JSON, Markdown | PDF, JSON, Markdown |
| Health Score | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| **Monitoring** |
| Weekly Digest | ❌ | ✅ | ✅ |
| **API & Integration** |
| API Access | Full | Full | Full + webhooks |

---

## Recent Updates (February 2026)

### Link Crawler Scope Fix ✅ COMPLETED (Feb 16, 2026)

**Problem:** Link crawler was checking ALL discovered links, not just links on audited pages
- Users saw "Links & Formatting" issues for pages they never audited (e.g., blog posts, docs)
- External links returned bot protection errors (403) and were reported as broken links
- Caused confusion: "Why am I seeing issues for pages I didn't audit?"

**Root cause:**
- Crawler extracted links from 4-20 audited pages (depending on tier)
- Then checked ALL those links via HTTP (~50-200 links)
- This included internal links to non-audited pages AND external links
- Result: PRO tier showed 89+ link issues vs 7 on FREE (1,171% explosion)

**Fix implemented:**
1. ✅ Added `auditedUrls` parameter to `crawlLinks()` function
2. ✅ Filter internal links to only check if they point to audited pages
3. ✅ Disabled external link checking (bot protection causes false positives)
4. ✅ Added debug logging showing filtered link counts

**Impact:**
- FREE tier: 0 HTTP link issues (only internal links between audited pages)
- PRO tier: Reduced from 89+ to minimal issues (only internal links between audited pages)
- All "Links & Formatting" issues now reference pages in audit results
- No more bot protection false positives from external links

**Files modified:**
- `lib/link-crawler.ts` - Added filtering logic and `auditedUrls` parameter
- `lib/firecrawl-adapter.ts` - Pass audited URLs to crawler, disable external checking

**Future consideration:**
- External link checking disabled until we have a reliable way to bypass bot protection
- May re-enable with Firecrawl for external links (already bypasses LinkedIn, Twitter, etc.)
- Or keep disabled permanently if internal link checks provide enough value

---

## Recent Updates (January 2026)

### Page Discovery UI & Field Cleanup ✅ COMPLETED

**Fixed discoveredPages population bug**
- ✅ `extractDiscoveredPagesList()` function existed but was never called
- ✅ Added calls in both `miniAudit()` and `auditSite()` functions
- ✅ Added `discoveredPages: string[]` to `AuditResult` type
- ✅ Fixed API response to include discoveredPages in meta object
- ✅ Deprecated unreliable `auditedUrls` field (just tool calls, not actual auditing)
- ✅ Created migration to drop unused `pages_found_urls` database column

**Built inline page discovery UI component**
- ✅ Created `PageDiscoveryInline` component showing "X of Y pages audited"
- ✅ Expandable list with checkmarks (✓) for audited pages, (○) for discovered pages
- ✅ Progressive disclosure: shows first 5, then "+X more" button
- ✅ Integrated into homepage results display
- ✅ Displays tier messaging (Free: 2 pages, Pro: up to 20)

**Files modified:**
- `lib/audit.ts` - Fixed discoveredPages population in both audit functions
- `app/api/audit/[id]/route.ts` - Fixed API response to include discoveredPages
- `components/PageDiscoveryInline.tsx` - New component
- `app/page.tsx` - Integrated new component
- `supabase/migrations/025_drop_unused_pages_found_urls.sql` - Database cleanup
- `docs/page-fields-audit.md` - Field inventory documentation

---

### Audit Timeout Configuration Fix ✅ COMPLETED

**Fixed mini audit timeout bug**
- ✅ Problem: `miniAudit()` had hardcoded 60-second timeout
- ✅ Root cause: Used `maxAttempts = 60` instead of tier config
- ✅ Fix: Changed to use `tier.maxPollSeconds` (240s for FREE tier = 4 minutes)
- ✅ Added proper timeout error message matching `auditSite()` behavior
- ✅ Applied same fix to `auditSite()` for consistency

**Impact:**
- Free tier audits now have 4 minutes instead of 1 minute to complete
- Reduces false timeout failures for legitimate audits
- Properly respects tier configuration

**Files modified:**
- `lib/audit.ts` - Lines 318-335 (miniAudit timeout), similar changes in auditSite

---

### Domain Display Bug Fix ✅ COMPLETED

**Fixed homepage domain header showing wrong URL**
- ✅ Problem: Domain header changed when typing in URL input field
- ✅ Root cause: `displayDomain` derived from URL input, not from audit results
- ✅ Fix: Updated `displayDomain` useMemo to prioritize `auditResults.domain` over URL input
- ✅ Now displays the actual audited domain, not the input field value

**Files modified:**
- `app/page.tsx` - Updated displayDomain calculation logic

---

### Dev Server Hot Reload Workaround ✅ COMPLETED

**Next.js 15 hot reload issue**
- ✅ Problem: Internal server errors after code changes, requiring full restart
- ✅ Root cause: Next.js 15 corrupts `.next` build cache during hot reload
- ✅ Specific errors: `ENOENT: no such file or directory, open '.next/routes-manifest.json'`
- ✅ Particularly affects: API routes (`app/api/**`) and lib files (`lib/**`)

**Workaround implemented:**
- ✅ Created `pnpm dev:clean` command in package.json
- ✅ Command deletes `.next` folder and restarts dev server
- ✅ Documented issue and workarounds in `docs/dev-hot-reload-issue.md`
- ✅ Includes guidance on when clean restart is needed vs regular restart

**Long-term solutions:**
- Wait for Next.js 15.x patch with better hot reload stability
- Consider moving heavy lib code to separate service
- Experiment with turbo mode (`pnpm dev --turbo`)

**Files modified:**
- `package.json` - Added `dev:clean` script
- `docs/dev-hot-reload-issue.md` - Full documentation with workarounds
- `next.config.js` - Already has webpack cache disabled (line 78), but issue persists

---

### Future: Multi-Model Parallel Execution 🧪 TEST SCRIPT READY

**Exploration documented for future optimization**
- 📝 Run multiple specialized model instances simultaneously
- 📝 Split audit into 3 parallel streams: Language, Facts & Consistency, Links & Formatting
- 📝 Potential 3x speed improvement (~60s to ~20s)
- 📝 Potential cost reduction with smaller focused prompts
- 📝 Higher accuracy with specialized models per category

**Test script created:**
```bash
pnpm test:parallel-audit <domain>
# Example: pnpm test:parallel-audit stripe.com
```

The script compares single-model vs 3 parallel models, tracking:
- Run time (wall clock)
- Token usage (input/output)
- Cost calculation
- Issues found by category
- Saves results to JSON for analysis

**Next steps:**
- [x] Create test script (`scripts/test-parallel-audit.ts`)
- [ ] Run test on 5-10 different domains
- [ ] Analyze results for speed, cost, accuracy patterns
- [ ] Evaluate if gains justify production implementation

**Documentation:**
- `docs/future-multi-model-exploration.md` - Full details and open questions
- `scripts/test-parallel-audit.ts` - Test script source

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
4. Results include all pages opened (audited URLs) and grouped issues with citations.

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

**Export formats for all authenticated users**

* ✅ Exports are available to all authenticated users (free, paid, enterprise).
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
* ✅ Export UI in dashboard (available to all authenticated users).
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

**Auth & User Flow Testing:** ✅ COMPLETE
- ✅ Test signup flow (email → magic link → dashboard)
- ✅ Test auto-claim on dashboard load (localStorage → API call → DB update)
- ✅ Test unauthenticated → authenticated flow (mock audit → signup → auto-claim)
- ✅ Test authenticated free tier (mock audit with account storage)
- ✅ Test user plan verification and gating
- ✅ Test concurrent claims (multiple users, same token edge cases)
- ✅ All 12 tests passing in `__tests__/auth-user-flow.test.ts`
- ⚠️ **Note:** RLS policy issue discovered and resolved - see `docs/RLS_POLICY_ISSUE.md` for details. Adopted permissive RLS policy with application-level security.

**Stripe Payment Testing:** ✅ COMPLETE

**Prerequisites:**
- ✅ Verify Stripe test mode enabled (STRIPE_MODE=test in .env.local)
- ✅ Verify Stripe test secret key configured (STRIPE_TEST_SECRET_KEY)
- ✅ Verify Stripe test publishable key configured (STRIPE_TEST_PUBLISHABLE_KEY)
- ✅ Create Stripe test product matching plan structure (Pro subscription)
- ✅ Get Stripe test webhook secret (STRIPE_TEST_WEBHOOK_SECRET) from Stripe dashboard
- ✅ Configure Stripe test webhook endpoint in Stripe dashboard (localhost:3000/api/webhook for local testing)
- ✅ Verify Stripe MCP server available for test data creation

**Checkout Session Creation (POST /api/create-checkout-session):**
- ✅ Test checkout session creation with valid request (returns Stripe checkout URL)
- ✅ Test checkout session includes correct metadata (email_capture_token, plan, created_at)
- ✅ Test checkout session uses correct price ID (STRIPE_TEST_PRO_PRICE_ID in test mode)
- ✅ Test checkout session has correct success_url (redirects to /dashboard?payment=success)
- ✅ Test checkout session has correct cancel_url (redirects to /account)
- ✅ Test checkout session allows promotion codes
- ✅ Test checkout session creation with emailCaptureToken in body
- ✅ Test checkout session creation without emailCaptureToken (optional)
- ✅ Test error handling when STRIPE_TEST_PRO_PRICE_ID is missing (500 error)
- ✅ Test error handling when Stripe API fails (network error, invalid key)
- ✅ Test PostHog error tracking on checkout failures

**Webhook Signature Verification (POST /api/webhook):**
- ✅ Test webhook rejects requests without stripe-signature header (400 error)
- ✅ Test webhook rejects requests with invalid signature (400 error)
- ✅ Test webhook accepts valid signature (200 response)
- ✅ Test webhook signature verification uses correct webhook secret (STRIPE_TEST_WEBHOOK_SECRET)
- ✅ Test webhook uses raw buffer for signature verification (not parsed JSON)
- ✅ Test webhook URL normalization (www to non-www domain handling)

**Webhook Event Processing:**
- ✅ Test checkout.session.completed event (payment success → plan update → email)
- ✅ Test checkout.session.async_payment_succeeded event (delayed payment success)
- ✅ Test checkout.session.expired event (abandoned cart → recovery email)
- ✅ Test customer.subscription.created event (plan activation)
- ✅ Test customer.subscription.updated event (plan reactivation if status=active)
- ✅ Test customer.subscription.deleted event (plan downgrade to free)
- ✅ Test unhandled event types (logged but not processed)
- ✅ Test webhook idempotency (same event processed twice, no duplicate actions)
- ✅ Test webhook error handling (event processing failures logged, 400 response)

**Payment Success Flow:**
- ✅ Test handlePaymentSuccess sends thank you email to customer
- ✅ Test handlePaymentSuccess marks email as sent (prevents duplicates)
- ✅ Test handlePaymentSuccess updates email_capture.payment_completed to true
- ✅ Test handlePaymentSuccess handles missing customer email gracefully
- ✅ Test handlePaymentSuccess extracts customer name and amount correctly
- ✅ Test handlePaymentSuccess uses correct email service (Resend)
- ✅ Test subscription checkout triggers handleSubscriptionActive
- ✅ Test handleSubscriptionActive updates profile.plan to 'pro'
- ✅ Test handleSubscriptionActive sets stripe_customer_id and stripe_subscription_id
- ✅ Test handleSubscriptionActive sets current_period_end from subscription
- ✅ Test handleSubscriptionActive resolves user_id from email via admin API
- ✅ Test handleSubscriptionActive handles missing email gracefully
- ✅ Test handleSubscriptionActive handles user not found gracefully

**Payment Cancel Flow:**
- ✅ Test cancel_url redirects to /account page
- ✅ Test cancel flow does not update profile.plan (stays 'free')
- ✅ Test cancel flow does not create subscription
- ✅ Test cancel flow does not send emails

**Subscription Lifecycle:**
- ✅ Test subscription.created sets plan to 'pro' with correct period_end
- ✅ Test subscription.updated reactivates plan if status='active'
- ✅ Test subscription.updated does not change plan if status='canceled'
- ✅ Test subscription.deleted downgrades plan to 'free'
- ✅ Test subscription.deleted clears stripe_subscription_id
- ✅ Test subscription.deleted clears current_period_end
- ✅ Test subscription lifecycle with multiple events (created → updated → deleted)

**Abandoned Cart Flow:**
- ✅ Test handleSessionExpired sends abandoned cart email
- ✅ Test handleSessionExpired includes discount code (COMEBACK20)
- ✅ Test handleSessionExpired includes recovery URL
- ✅ Test handleSessionExpired checks promotional consent (only sends if opt_in)
- ✅ Test handleSessionExpired marks email as sent (prevents duplicates)
- ✅ Test handleSessionExpired handles missing email gracefully
- ✅ Test handleSessionExpired handles missing recovery URL gracefully

**Billing Portal (POST /api/portal):**
- ✅ Test portal session creation with explicit customerId
- ✅ Test portal session creation resolves customerId from authenticated user email
- ✅ Test portal session creation searches Stripe customers by email
- ✅ Test portal session has correct return_url (/dashboard)
- ✅ Test portal session creation requires authentication (401 if no token)
- ✅ Test portal session creation handles invalid token (401 error)
- ✅ Test portal session creation handles user not found (401 error)
- ✅ Test portal session creation handles no Stripe customer found (404 error)
- ✅ Test portal session creation error handling (500 on Stripe API failure)

**Plan Activation & Database Updates:**
- ✅ Test profile.plan updates from 'free' to 'pro' on successful payment
- ✅ Test profile.stripe_customer_id is set correctly
- ✅ Test profile.stripe_subscription_id is set correctly
- ✅ Test profile.current_period_end is set from subscription period_end
- ✅ Test profile update uses upsert with onConflict='user_id'
- ✅ Test plan activation works for existing users (update, not insert)
- ✅ Test plan activation works for new users (insert profile if missing)
- ✅ Test plan downgrade clears subscription fields (stripe_subscription_id, current_period_end)
- ✅ Test plan downgrade sets plan to 'free' (not null)
- ✅ Test concurrent webhook events (same subscription, multiple events) handled correctly

**Email Integration:**
- ✅ Test thank you email sent with correct customer details (email, name, amount, currency)
- ✅ Test thank you email includes session ID
- ✅ Test abandoned cart email sent with discount code and recovery URL
- ✅ Test email service error handling (failures logged, don't break webhook)
- ✅ Test email idempotency (same email not sent twice)
- ✅ Test email_captures table updated correctly (payment_completed flag)
- ✅ Test email_captures table tracks abandoned_email_sent flag

**Error Handling & Edge Cases:**
- ✅ Test webhook handles malformed JSON payload gracefully
- ✅ Test webhook handles missing event type gracefully
- ✅ Test webhook handles missing event data gracefully
- ✅ Test handleSubscriptionActive handles Stripe API errors gracefully
- ✅ Test handleSubscriptionActive handles missing subscription gracefully
- ✅ Test handleSubscriptionActive handles deleted customer gracefully
- ✅ Test setPlanFree handles Stripe API errors gracefully
- ✅ Test setPlanFree handles missing customer gracefully
- ✅ Test email service failures don't break webhook processing
- ✅ Test database update failures logged but don't crash webhook

**Redirects & URLs:**
- ✅ Test success_url redirects to /dashboard?payment=success (no session_id placeholder needed)
- ✅ Test success_url uses correct APP_URL from environment
- ✅ Test cancel_url redirects to /account (updated from /preview)
- ✅ Test return_url in portal redirects to /dashboard
- ✅ Test URL construction handles different environments (dev, staging, prod)

**Integration Tests (Real Stripe API):**
- ✅ Test full payment flow: checkout → webhook → plan update → email
- ✅ Test full cancel flow: checkout → cancel → no plan change
- ✅ Test full subscription lifecycle: create → update → delete
- ✅ Test authenticated user checkout flow (user exists, profile updated)
- ✅ Test email capture token reconciliation (webhook matches email capture)
- ✅ All 17 tests passing in `__tests__/stripe-payment.test.ts` using REAL Stripe test API

**Test Implementation:**
- ✅ Use Stripe test mode (STRIPE_MODE=test) for all tests
- ✅ Generate test webhook signatures using Stripe SDK
- ✅ Create test Stripe products and prices matching plan structure
- ✅ Mock email service to avoid sending real emails during tests
- ✅ Use test database for profile updates (isolated from production)
- ✅ Test with real Stripe test API (not fully mocked) for integration confidence
- ✅ Created `__tests__/stripe-payment.test.ts` with comprehensive test coverage
- ✅ Use test helpers for creating mock Stripe events
- ✅ Use test helpers for creating test users and profiles
- ✅ Use test helpers for cleaning up test data (profiles, email_captures)

**UI & Display Testing (Mock Data):** ⚠️ IN PROGRESS

**Phase 1: Dashboard UI Fix & Verification (Priority 1)**
- ✅ Fix sidebar overlapping content (layout structure) - Fixed cookie name mismatch (`sidebar:state` → `sidebar_state`), converted layout to server component, fixed sidebar width CSS variable
- ✅ Fix health score cards not rendering/loading
- ✅ Fix health score chart not displaying
- ✅ Verify dashboard matches shadcn example structure
- ✅ Test with hardcoded mock data first (before DB connection)

**Phase 2: Database Domain Normalization Fix (Priority 2)**
- ✅ **CRITICAL:** Fix domain format mismatch (stored as `https://apple.com`, API queries `apple.com`)
- ✅ Update all existing audit domains to normalized format (remove protocol)
- ✅ Verify health score API can fetch data after normalization
- ✅ Test domain normalization in audit creation (ensure new audits use normalized format)

**Phase 3: Mock Data Pipeline Testing (Priority 3)**
- ✅ Test homepage flow with mock audit results (results display, session token storage)
- ✅ Test dashboard audit list display with mock audits (verify 35+ audits visible)
- ✅ Test health score cards display with mock data (4 cards: Current Score, Trend, Active Issues, Critical Issues)
- ✅ Test health score line chart rendering with 1+ days of mock time-series data
- ✅ Test issues table displays most recent audit's issue types
- ✅ Test export UI (dropdown menu, loading states, error handling)
- ✅ Test export formats with mock data (PDF formatting, JSON schema, Markdown structure)
- ✅ Test export for all users
- ✅ Test progress polling UI (homepage) with mock in-progress states
- ✅ Test empty audit results display (`?testEmpty=true` on homepage/dashboard)
- ✅ Test very large audits display (many issues, pagination) (`?testLarge=true` on dashboard)
- ✅ Test severity filtering tabs with mock data
- ✅ Test issue state filtering (active/ignored/resolved) with mock data

**Health Score UI Testing (Mock Data):**
- ✅ Test health score calculation display with various issue combinations (low/medium/high severity)
- ✅ Test health score color coding (green 80+, yellow 50-79, red <50)
- ✅ Test trend indicator (up/down arrow vs previous period)
- ✅ Test health score line chart rendering with mock time-series data (30 days wavy pattern)
- ✅ Test time range selector (30/60/90 days) updates chart data
- ✅ Test chart tooltip showing score + metrics for each point
- ✅ Test supporting metrics cards display (Total Active Issues, Total Critical Issues, Pages with Issues, Critical Pages)
- ✅ Test filtering of ignored issues in health score calculation
- ✅ Test empty states (no audits, no issues) - show appropriate message
- ✅ Test single audit display (score shown but no trend line)
- ✅ Test all issues ignored scenario (score should be 100)
- ✅ Test score clamping (negative scores show as 0, scores >100 show as 100)
- ✅ Test multiple domains scenario (defaults to most recent audit's domain)

**Rate Limiting UI Testing (Mock Data):**
- ✅ Test "Run New Audit" button shows limit status ("X/Y audits today", "X/Y domains")
- ✅ Test button disabled state when daily limit reached
- ✅ Test tooltip display when limit reached (shows upgrade message)
- ✅ Test domain count display for pro users ("3/5 domains")
- ✅ Test usage indicator component showing limits correctly
- ✅ Test upgrade prompt when limit reached
- ✅ Test limit status updates after audit completion
- ✅ Test limit reset display (shows reset time)

**Domain Management UI Testing (Mock Data):**
- ✅ Test domain list display showing all user domains
- ✅ Test domain deletion confirmation dialog appears
- ✅ Test deletion removes domain from list
- ✅ Test domain count updates after deletion
- ✅ Test user can immediately add new domain after deletion (if at limit)
- ✅ Test deletion loading state (button disabled, spinner shown)
- ✅ Test deletion error handling (shows error message, domain remains in list)
- ✅ Test empty domain state (no domains message)

**AI Model Testing (Expensive - Do After Mock Data Works):**
- ✅ **ONLY AFTER:** All mock data tests pass and dashboard renders correctly
- ✅ Set `USE_MOCK_DATA=false` in `.env.local`
- ⚠️ Test mini audit via API (curl or Postman - happy path, error cases, timeout)
- ⚠️ Test mini audit via UI (actual model calls)
- ⚠️ Test full audit with background execution
- ⚠️ Test model timeout handling
- ⚠️ Test model error recovery
- ⚠️ Test different tier configurations (FREE/PAID/ENTERPRISE model selection)
- ⚠️ Test tool call limits and enforcement
- ⚠️ Re-enable rate limits after testing complete (uncomment in `lib/audit-rate-limit.ts`)

**Mock Data Strategy:**
- ✅ Generate mock audit results matching API response schema (`groups`, `meta`, `totalIssues`, etc.)
- ✅ Store mock audits in test database with various states (completed, in_progress, failed)
- ✅ **CRITICAL:** Ensure domain format consistency (normalized: `apple.com`, not `https://apple.com`)
- ✅ Use dedicated test account: `l.gichigi@gmail.com` (user_id: `a232d31e-59d6-478c-864a-03ce9bebe79f`)
- ✅ Use test domain: `apple.com` (already has 35 historical audits inserted)
- ✅ Use mock data for all UI, API, and database testing to avoid model costs
- ✅ Create test fixtures for different scenarios (empty results, many issues, various severities)
- ✅ Mock issue states (active/ignored/resolved) for lifecycle testing
- ✅ Only use actual model calls for final integration testing after non-AI components are verified

**Step-by-Step Testing Execution Plan:**

**Step 1: Fix Domain Normalization (5 min)**
```sql
-- Normalize all existing domains to match API expectations
UPDATE brand_audit_runs 
SET domain = REPLACE(REPLACE(REPLACE(domain, 'https://', ''), 'http://', ''), 'www.', '')
WHERE domain LIKE 'https://%' OR domain LIKE 'http://%';
```

**Step 2: Verify Dashboard UI Structure (15 min)**
- Compare dashboard layout to shadcn example (`/design-system`)
- Fix sidebar overlap (ensure `SidebarInset` has correct flex classes)
- Fix card rendering (verify container queries working)
- Fix chart display (verify data prop passed correctly)
- Test with hardcoded data first (no DB calls)

**Step 3: Test Mock Data Pipeline (10 min)**
- Refresh dashboard (hard refresh: Cmd+Shift+R)
- Verify health score cards display (4 cards with scores)
- Verify health score chart displays (30 days line chart)
- Verify issues table displays (10 issue types from most recent audit)
- Check browser console for errors

**Step 4: Test Full E2E with Real AI (30 min)**
- Set `USE_MOCK_DATA=false` in `.env.local`
- Run new audit via UI
- Verify audit completes and saves to DB
- Verify dashboard updates with new audit
- Verify health score recalculates
- Re-enable rate limits when done

**Test Account Configuration:**
- Email: `l.gichigi@gmail.com`
- User ID: `a232d31e-59d6-478c-864a-03ce9bebe79f`
- Plan: `free` (limits temporarily disabled)
- Test Domain: `apple.com` (35 historical audits)

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

### Phase 6: Health Score + History (Retention Engine) ✅ COMPLETE

**Health Score Formula** ✅ COMPLETE

* ✅ Start at 100 - Implemented in `lib/health-score.ts`
* ✅ Subtract: low×1, medium×3, critical×7 (severity-weighted active issues) - Implemented
* ✅ Subtract: critical_pages_with_errors×10 (pages with at least one critical-severity issue) - Implemented
* ✅ Exclude ignored issues from calculation - Implemented via `audit_issue_states` filtering
* ✅ Clamp result to 0-100 - Implemented with Math.max/Math.min

**Health Score API** ✅ COMPLETE

* ✅ GET `/api/health-score` endpoint - Returns health score history over time range (30/60/90 days)
* ✅ Calculates score for each audit date - Groups audits by date, aggregates metrics
* ✅ Returns current score and historical data - Includes supporting metrics (totalActive, totalCritical, criticalPages, pagesWithIssues)
* ✅ Available to all authenticated users (free, paid, enterprise) - No plan gating

**Dashboard Display** ✅ COMPLETE

* ✅ Shadcn dashboard block structure - Uses `SectionCards`, `HealthScoreChart`, and `DataTable` components
* ✅ Available to all authenticated users (free, paid, enterprise) - Full dashboard experience for all plans
* ✅ Large health score card with color coding (green 80+, yellow 50-79, red <50) - Implemented in dashboard
* ✅ Trend indicator (up/down arrow vs previous period) - Shows score change
* ✅ Line chart over time (30/60/90 days) - `HealthScoreChart` component with time range selector
* ✅ Supporting metrics cards grid:
  * ✅ Total Active Issues - Count of non-ignored issues
  * ✅ Total Critical Issues - Count of critical-severity issues
  * ✅ Pages with Issues - Count of unique pages with active issues
  * ✅ Critical Pages - Count of pages with at least one critical-severity issue
* ✅ DataTable component - Displays audit results in interactive table format (replaces card list view)
* ✅ Dashboard layout - Sidebar navigation, header, and main content area with cards, chart, and table

**Audit Run Limits & Rate Limiting** ✅ COMPLETE

* ✅ `audit_usage` table created - Tracks daily audit counts per user/domain
* ✅ Rate limiting logic implemented - Checks daily and domain limits before audit execution
* ✅ Free tier: 1 domain, 1 audit per day - Enforced in `/api/audit` route
* ✅ Pro tier: 5 domains, 1 audit per day per domain - Enforced with domain count check
* ✅ Enterprise tier: Unlimited audits and domains - No limits enforced
* ✅ "Run New Audit" button shows limit status - Displays "X/Y audits today" and "X/Y domains"
* ✅ Button disabled when daily limit reached - With tooltip showing upgrade message
* ✅ Domain deletion feature - Users can delete domains to free up slots
* ✅ Domain deletion API endpoint - `DELETE /api/domains/[domain]` with cascade deletion
* ✅ Pricing page updated - Shows audit limits for all plans

**Implementation Files:**

* ✅ `lib/health-score.ts` - Health score calculation logic
* ✅ `app/api/health-score/route.ts` - Health score API endpoint (available to all authenticated users)
* ✅ `lib/audit-rate-limit.ts` - Rate limiting utilities
* ✅ `app/api/domains/[domain]/route.ts` - Domain deletion endpoint
* ✅ `app/api/audit/usage/route.ts` - Usage info API endpoint
* ✅ `components/health-score-chart.tsx` - Health score line chart component
* ✅ `components/section-cards.tsx` - Metric cards component (shadcn dashboard block)
* ✅ `components/chart-area-interactive.tsx` - Chart component (shadcn dashboard block)
* ✅ `components/data-table.tsx` - Data table component (shadcn dashboard block)
* ✅ `app/dashboard/page.tsx` - Dashboard page with shadcn block structure (cards, chart, table)
* ✅ `app/pricing/page.tsx` - Audit limits displayed on pricing cards

---

### Phase 7: High-Value Paid Expansions

**Enterprise audit prompt**

* Create separate `ENTERPRISE_AUDIT_PROMPT` that extends base prompt with enterprise-only categories.
* Include instructions for:
  * Competitor analysis and comparison
  * Custom audit request handling
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

### Phase 8: Dashboard Sidebar + Audit Configuration

**Dashboard sidebar**

* Add collapsible sidebar to dashboard layout using `components/app-sidebar.tsx`.
* Integrate with existing dashboard page structure.
* Responsive design (collapsible on mobile, persistent on desktop).

**Domain selector**

* Dropdown/select component showing all user's audited domains.
* Filter health score, charts, and audit list by selected domain.
* Default to most recent audit's domain.
* Persist selection in localStorage or URL query param.

**Brand tone of voice editor**

* Text editor for brand voice guidelines (markdown support).
* Store in `guidelines` table (reuse existing schema).
* Link to audit runs via `guideline_id` foreign key.
* Display current active guideline in sidebar.
* Allow switching between multiple guidelines.

**Audit settings panel**

* Collapsible settings section in sidebar.
* **Issue categories**: Toggle which categories to detect (typos, grammar, terminology, etc.).
* **Severity thresholds**: Customize what counts as high/medium/low (e.g., set minimum threshold for high severity).
* **Custom keywords**: Add keywords/phrases to flag (e.g., deprecated product names, old pricing tiers).
* **Excluded URLs**: List of URL patterns to exclude from audits (e.g., `/admin/*`, `/staging/*`).
* **Page depth limits**: Maximum crawl depth for audits (default based on tier).
* Store settings per domain in new `audit_settings` table or JSONB column on `profiles`.
* Apply settings to future audits via audit prompt customization.

**Implementation**

* Create `audit_settings` table with columns: `user_id`, `domain`, `issue_categories` (JSONB), `severity_thresholds` (JSONB), `custom_keywords` (TEXT[]), `excluded_urls` (TEXT[]), `page_depth_limit` (INTEGER).
* Update audit prompt generation to include custom settings.
* Add sidebar component to `app/dashboard/page.tsx`.
* Create settings UI components (toggles, text inputs, URL pattern editor).

---

### Phase 9: AI Writing Detection

**Detect AI-generated content patterns**

* Flag content that exhibits common AI writing characteristics based on [Wikipedia's signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).
* Help teams identify content that may need human review or rewriting.

**Content patterns**

* Undue emphasis on symbolism, legacy, and importance.
* Superficial analyses without depth.
* Promotional and advertisement-like language.
* Outline-like conclusions about challenges and future prospects.
* Vague "see also" sections.

**Language patterns**

* Overused "AI vocabulary" words (e.g., "delve", "tapestry", "testament").
* Negative parallelisms ("not just X, but Y").
* Rule of three structures.
* Vague attributions of opinion ("some argue", "many believe").
* False ranges ("from X to Y" without specificity).

**Style markers**

* Title case overuse.
* Excessive boldface formatting.
* Inline-header vertical lists.
* Emojis in professional content.
* Overuse of em dashes.
* Curly quotation marks and apostrophes.

**Communication patterns**

* Collaborative communication markers ("let's", "we can").
* Knowledge-cutoff disclaimers and speculation about gaps.
* Prompt refusal language.
* Phrasal templates and placeholder text.

**Markup and citation issues**

* Markdown syntax in HTML content.
* Broken wikitext or reference markup.
* Broken external links.
* Invalid DOIs and ISBNs.
* Incorrect or unconventional reference usage.

**Implementation**

* Add AI writing detection category to audit prompt.
* Use Deep Research to analyze content patterns across pages.
* Report issues with severity based on confidence and impact.
* Include examples and suggested human rewrites.
* Gate to paid/enterprise tiers (high-value feature).

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
- For free tier users
- Uses `gpt-5.1-2025-11-13` with `web_search` tool
- Opens homepage + 1 key page directly (no Puppeteer)
- Limited to 10 tool calls via `max_tool_calls` parameter
- Synchronous execution (~2-3 minutes)
- Comprehensive issue detection across all categories

**`auditSite(domain, tier)`**
- For paid/enterprise users
- Uses `o4-mini-deep-research` (paid) or `o3-deep-research` (enterprise) with `web_search_preview` tool
- Auto-crawls domain up to tier limit (controlled by `max_tool_calls`)
- Background execution for long-running audits
- Supports polling via `pollAuditStatus(responseId)`

### Tier Configuration

```typescript
AUDIT_TIERS = {
  FREE: { maxToolCalls: 10, background: false, model: "gpt-5.1-2025-11-13" },
  PAID: { maxToolCalls: 50, background: true, model: "o4-mini-deep-research" },
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
