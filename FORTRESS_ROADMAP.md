# Fortress v1 Roadmap (Bible)

Goal: Ship a focused v1 that proves value, converts to Pro, and sets clean foundations for growth.

Stack guardrails: Supabase Auth (EU), Stripe Checkout + Portal, PostHog, Next.js 15+, single LLM refine for audit, Plate editor MVP.

Entitlements: Free "Outpost" (1 guide, 5 audit issues, MD export), Pro "Watchtower" (unlimited guides, full audit, PDF/Word/HTML).

Tabs: Guidelines, Audit. Account page: name/email/password, Manage Billing, delete account (if required in EU).

---

## Core User Flow (v2)

The exploration-based flow that differentiates Fortress from ChatGPT-generated guidelines.

**Step 1 — Scrape Site**
User enters URL. System extracts brand name, description, inferred audience, tone signals.

**Step 2 — Confirm Brand Details**
User reviews/edits extracted info. Fills gaps if needed.

**Step 3 — Clarifying Questions**
Nuanced questions about business, audience, products, values. Multiple choice or short text.

**Step 4 — A/B Comparisons**
5-8 quick "Which sounds more like your brand?" pairs. Gathers stylistic preference signal.

**Step 5 — Voice Profile**
System synthesizes one voice profile based on Steps 1-4.

- **"Yes, this is good"** → Step 6
- **"Not quite right"** → Options:
  - *Quick adjust:* "What feels off?" (too formal, too playful, missing X) → Regenerate profile → Return to Step 5
  - *Go back:* Return to Step 4 (A/B) to redo preferences
  - *Proceed anyway:* Continue to Step 6, refine in editor

**Step 6 — Generate Guidelines**
Full brand voice guidelines generated from confirmed profile.

**Step 7 — Editor + "Talk to Guidelines"**
User can:
- Edit sections directly
- Chat to make sweeping changes, regenerate parts, ask questions
- Add new rule sets
- Create versions

**Step 8 — Export**
PDF, Word, HTML, Markdown. Share link.

**Skip paths:**
- After Step 2: Skip to Step 6 (power users)
- After Step 5 "Not quite right": Proceed anyway (impatient users)

---

## 🎯 Next Steps (Priority Order)

### 1. Complete User Flow Migration (Legacy → New) — **IN PROGRESS**
Migrate from legacy `full-access` page to new editor-based flow to complete Core User Flow (v2).

**Status:** Partially complete — generation APIs save to DB, but some frontend redirects and editor integration still pending.

**Remaining work:**
- [ ] Editor integration: Load voice profile data if available
- [ ] Editor integration: Show onboarding context (A/B selections, voice profile) in editor sidebar or metadata
- [ ] Phase 6: Add section-level "Regenerate" actions (traits, rules, before/after, summary, keywords)

### 2. Phase 6 — Editor MVP (Plate) — **PARTIALLY COMPLETE**
- ✅ Integrate Plate editor for inline edits on guideline content
- ✅ Provide undo/redo and autosave; show save status in UI
- ❌ Add section-level "Regenerate" actions — **Not yet implemented**

### 3. Auth Polish (Optional)
- [x] Update `/sign-up` page copy and styling:
  - Change "Sign in with email" → "Continue with email"
  - Update copy: "We'll send you a secure link. No password needed."
  - Restyle to match Fortress design system (serif fonts, muted neutrals, straight edges, remove blue gradient)
  - Consider renaming route to `/auth` or `/continue`

### 4. Production Deployment Prep
- [ ] Update Supabase auth config for production:
  - Set `site_url` to production domain (e.g., `https://aistyleguide.com`)
  - Add production URLs to `uri_allow_list` / redirect URLs
  - Update magic link email template `{{ .SiteURL }}` will auto-use production URL
- [ ] Update `.env` production values:
  - `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_WEBHOOK_URL`
- [ ] Verify Stripe webhook URL points to production

### 5. QA Testing
- [ ] Run through QA checklist (see below)
- [ ] Test all critical user flows end-to-end
- [ ] Verify error handling and edge cases

---

## Completed Work

### Data Persistence for Onboarding Flow (Completed)

User should be able to reach voice profile, then sign up/sign in, and have everything saved to their account.

**Database changes:**
- ✅ Create `brand_onboarding` table with JSONB columns for brandDetails, clarifyingAnswers, abRounds, voiceProfile
- ✅ Include `session_token` for linking before auth, `user_id` for after auth
- ✅ Status field: in_progress, completed
- ✅ Applied `language_tag` migration to guidelines table

**API endpoints:**
- ✅ `POST /api/onboarding/save` — Save current state (with session token for unauthenticated)
- ✅ `GET /api/onboarding/load` — Load state (by user_id or session token)
- ✅ `POST /api/onboarding/claim` — Link session data to user after auth

**Frontend changes:**
- ✅ Generate session token on first visit to brand-details
- ✅ Auto-save to API at each step (brand details confirmed, questions answered, A/B selections, voice profile) with 1s debounce
- ✅ On auth success, call claim endpoint to link data to user account
- ✅ Load existing onboarding data if user returns
- ✅ Maintain localStorage fallback for migration

---

## Complete User Flow Migration (Legacy → New)

Migrate from legacy `full-access` page to new editor-based flow to complete Core User Flow (v2).

**Status:** ✅ Backend complete | ⚠️ Frontend mostly complete | ❌ Editor integration pending

**Completed:**
- ✅ Backend: Generation APIs save to database immediately (`/api/preview`, `/api/generate-styleguide`)
- ✅ Backend: Return guideline ID from generation APIs
- ✅ Backend: Guideline linked to user account
- ✅ Frontend: `brand-details` flow redirects to `/guidelines/[id]` after generation
- ✅ Frontend: Design-system Alerts for errors in brand-details, preview, payment success
- ✅ Frontend: Duplicate guideline prevention on preview page
- ✅ Frontend: Updated references to `/full-access`:
  - ✅ Dashboard "Upgrade" button → points to editor or upgrade flow
  - ✅ Payment success redirect → `/guidelines/[id]`
  - ✅ Email links → `/guidelines/[id]`
  - ✅ Stripe Portal return URL → dashboard
- ✅ Frontend: `/full-access` page deprecated with auto-redirect

**Remaining:**
- [ ] Editor integration: Load voice profile data if available
- [ ] Editor integration: Show onboarding context (A/B selections, voice profile) in editor sidebar or metadata
- [ ] Phase 6: Add section-level "Regenerate" actions (traits, rules, before/after, summary, keywords)

---

---

## Implementation Phases

### ✅ Completed Phases

#### Phase 0 — Repo and config (Completed)
- Fork AISG to Fortress without altering current production
- Create env scaffolds (local, prod) with EU data region for Supabase
- Create new Supabase EU project for Fortress (not AISG); run migrations and align `profiles` schema (pk `user_id`)
- Wire PostHog project keys (local/prod) and basic funnel events

#### Phase 1 — Auth foundation (Completed)
- ✅ Add Supabase Auth (email link + Google) with EU region
- ✅ Create user profile row on first login (plan: free) — via database trigger (`006_add_profile_trigger.sql`)
- ✅ Protect app routes; redirect unauthenticated to signin or extractor — global middleware

**Auth implementation details:**
- ✅ Automatic profile creation via database trigger (Supabase-recommended approach)
- ✅ Global middleware for route protection (`middleware.ts` + `lib/supabase-middleware.ts`)
- ✅ Auth callback route handler (`/auth/callback/route.ts`) for PKCE flow
- ✅ `@supabase/ssr` package for server-side auth with proper cookie handling
- ✅ Verify profiles table schema matches code (`user_id` primary key confirmed)

**Auth polish (optional):**
- Update `/sign-up` page copy and styling:
  - Change "Sign in with email" → "Continue with email" (magic link does both sign-up and sign-in)
  - Update copy: "We'll send you a secure link. No password needed."
  - Restyle to match Fortress design system (serif fonts, muted neutrals, straight edges, remove blue gradient)
  - Consider renaming route to `/auth` or `/continue` to avoid confusion

#### Phase 2 — Plans and billing (Completed)
- Create Stripe Pro monthly price and link to Customer Portal
- Implement upgrade/downgrade via Checkout/Portal
- Sync plan status via webhook; update profile.plan and period end

#### Phase 3 — Guidelines model (no projects in v1) (Completed)
- Define "guideline" entity per user (no project layer yet)
- Create CRUD: create from extractor, read latest, duplicate, delete
- Enforce free/pro limits at API and UI

#### Phase 4 — Extractor + Audit v1 (Completed)
- Crawl homepage + up to 5 internal links (3s timeout, same domain)
- Run heuristics (meta, H1 count, brand casing, long sentences, exclamations)
- Run single LLM refine pass to group/dedupe and add clear recommendations (prompt supplied)
- Return audit payload with links/snippets; store alongside guideline
- Gate free: show up to 5 issues; Pro: show full list
- On upgrade: unlock saved full audit instantly; expose "Re‑run audit" (Pro)

#### Phase 5 — Guideline generation and gating (Completed)
- Reuse existing generation pipeline; pass locale (US/UK) into prompts
- Persist guideline content on create; maintain last_modified timestamp
- Gate exports and advanced sections per plan
- Advanced (on‑demand) generators (watchtower priority; some items may be previewed in outpost):
  - 10 SEO keywords (derive from site content + model; optionally enrich via Firecrawl search)
  - 25 technical writing rules to support the voice (select best 25)
  - 5 typography suggestions aligned to the voice
  - Up to 30 brand glossary terms

#### Phase 7 — Dashboard and Account (Completed)
- Landing page: Replace with new minimal page. Current page too monolithic. Remove complex hero/feature grid/FAQ/pricing. Keep it direct—single CTA, clean headline, minimal nav, optionally 1-sentence demo/testimonial. All product entry points (demo, extract, etc) link from or are merged into this page.
- Brand details flow: Update /brand-details page with audience, brand values, and content audit sections. Remove trait selection (traits now auto-suggested from brand info). Add clarifying questions step after brand details.
- Dashboard: list user guidelines with quick actions (Open, Duplicate, Delete)
- Audit tab: list issues with page links, severity, recommendations, re‑run (Pro)
- Account: name/email/password, Manage Billing (Stripe Portal link), delete account (EU compliance)

#### Phase 8 — Exports (Completed)
- Free: Markdown export only
- Pro: PDF, Word (HTML/DOCX), HTML exports with consistent branding
- Add watermark toggle for Pro exports

#### Phase 9 — Analytics and funnels (Completed)
- ✅ Track funnel: extract → audit viewed → edit → export → upgrade using PostHog
- ✅ Track upgrade CTAs from audit gating and exports
- ✅ Add error logging for crawl, LLM, generation, billing, exports

**Error logging coverage:**
- ✅ `/api/audit` — crawl errors
- ✅ `/api/analyze-brand` — LLM errors
- ✅ `/api/preview` — generation errors
- ✅ `/api/generate-styleguide` — generation errors
- ✅ `/api/create-checkout-session` — billing errors
- ✅ `/api/export/[id]` — export errors

#### Phase 10 — Brand and comms (Completed)
- Update app copy, headers/footers, emails to "Fortress" (domain decision later)
- Keep aistyleguide.com for now; plan 301s and Search Console later
- Keep current sender; plan RESEND domain switch later (SPF/DKIM)

#### Phase 11 — QA and launch (Completed)
- Test EU data path, auth flows, billing webhooks, entitlement gates
- Test crawl on slow/JS‑heavy pages; ensure graceful fallbacks
- Validate locale toggle (US/UK) across generation and examples
- Final content pass; ship v1 to production

### ⚠️ Partially Complete / Pending Phases

#### Phase 6 — Editor MVP (Plate) (Partially Completed)
- ✅ Integrate Plate editor for inline edits on guideline content
- ✅ Provide undo/redo and autosave; show save status in UI
- ❌ Add section‑level "Regenerate" actions (traits, rules, before/after, summary, keywords) — **Not yet implemented**

### QA Checklist

**Authentication:**
- [ ] Email link sign-in works (check email, click link, verify redirect)
- [ ] Google OAuth sign-in works (click button, complete OAuth, verify redirect)
- [ ] Sign out works and redirects appropriately
- [ ] Protected routes redirect unauthenticated users to sign-up

**Billing:**
- [ ] Stripe checkout creates subscription session correctly
- [ ] Payment success page loads and generates guideline
- [ ] Stripe webhook updates profile.plan and current_period_end
- [ ] Billing Portal accessible from Account page
- [ ] Plan changes reflect immediately after webhook

**Guidelines:**
- [ ] Create guideline (Outpost: blocked if one exists, Watchtower: unlimited)
- [ ] Edit guideline content in Plate editor
- [ ] Autosave works (1.5s debounce)
- [ ] Explicit save creates version snapshot
- [ ] Duplicate guideline (Watchtower only)
- [ ] Delete guideline

**Audit:**
- [ ] Run audit on homepage (Outpost: shows up to 5 issues, Watchtower: all issues)
- [ ] View audit results in Dashboard Audit tab
- [ ] Re-run audit (Watchtower only, crawls up to 20 pages)
- [ ] Audit issues show severity, recommendations, and page links

**Exports:**
- [ ] Markdown export works (all plans)
- [ ] PDF export (Watchtower only, returns HTML for client-side conversion)
- [ ] DOCX export (Watchtower only, proper Word document)
- [ ] HTML export (Watchtower only)
- [ ] Export gating shows upgrade message for free users

**Locale:**
- [ ] Locale detected from website `<html lang>` attribute
- [ ] Locale detected from meta content-language
- [ ] Locale question appears in clarifying questions if not detected
- [ ] US English (en-US) spelling/punctuation in generated content
- [ ] UK English (en-GB) spelling/punctuation in generated content
- [ ] Language tag stored on guideline record

**EU Data Path:**
- [ ] Supabase EU region confirmed in project settings
- [ ] No data sent to non-EU services (verify PostHog, Stripe regions)
- [ ] Delete account removes all user data (GDPR compliance)
- [ ] Profile deletion works from Account page

**Error Handling:**
- [ ] Crawl errors logged to PostHog
- [ ] LLM errors logged to PostHog
- [ ] Export errors logged to PostHog
- [ ] Billing errors logged to PostHog
- [ ] User sees helpful error messages (not raw errors)

**Performance:**
- [ ] Homepage audit completes within 10s
- [ ] Guideline generation completes within 2-3 minutes
- [ ] Editor autosave doesn't block UI
- [ ] Large guideline documents load and edit smoothly

---

## Acceptance criteria (v1)
- Users can sign in, generate one guideline, view 5 audit issues, export MD (Free)
- Upgrading unlocks full audit, unlimited guidelines, and PDF/Word/HTML exports (Pro)
- Editor supports inline edit, regenerate sections, autosave, undo/redo
- Locale toggle (US/UK) affects outputs; PostHog shows core funnel

## Post‑v1 (not in scope)
- Teams/orgs and seats; projects layer; comments; Whisper input; 301s and sender domain switch
- Add “What to do next” page post‑export (guidance/checklist for applying outputs)


## User Stories

As an in-house copywriter/content lead, I want to be able to:

Assess whether this service is good enough to generate tailored and specific brand voice guidelines 

So that I can pitch it to stakeholders and use it to maintain our bv going forward

Copywriter flow:
1. See Apple Demo
2. Enter company website
3. Edit brand details
4. Answer clarifying questions
4.5 Select A/B comparisons
5. See Brand profile, proceed
6. sign up
7. sign up complete, lands on dashboard 
8. Navigate to guidelines, show to team
9. Get approval
10. Return, sign in
11. Edit, add new brand voice sections
12. Export & share with team

-

As a digital agency I want to be able to:

generate and edit an impressive set of brand voice guidelines

So that I can present them within the client pitch and/or use as an upsell.

Agency flow:
1. See Apple Demo
2. Upload/Enter client brand details
3. Start clarifying questions
4. Save progress =. Sign up
5. Return, sign in, land on dashboard 
6. finishes answering questions
7. Skim through guidelines
8. Save for later
9. Return, sign in
10. Edit guidelines/add media to make presentable
11. Export & pitch to client

-

As a small startup founder or builder I want to be able to:

Quickly generate a brand voice and immediately start using it

So that my content can stand out in the market

Founder flow:
1. Describe brand idea via text/voice
2. Sign up
3. Skip clarifying questions
4. See brand voice guidelines
5. Update brand details, regenerate guidelines, edit
6. Goes to export = sign up
7. Exports, integrates with AI IDE

---

## Reference: Files with "aistyleguide" References (Update Later)

The following files still contain references to "aistyleguide", "AIStyleGuide", or "AI Style Guide" that may need updating in the future (domain decision pending):

**User-facing (already updated):**
- `app/layout.tsx` - metadata updated, domain URLs kept
- `app/preview/page.tsx` - branding updated
- `app/payment/success/page.tsx` - branding updated
- `app/blog/page.tsx` - branding updated
- `app/blog/[slug]/page.tsx` - branding updated
- `lib/email-service.ts` - email copy updated

**Internal/scripts (update as needed):**
- `scripts/retro-link-posts.js`
- `scripts/update-batch5-links.sql`
- `scripts/fix-retro-linked-posts.sql`
- `scripts/update-batch4-links.sql`
- `lib/blog-prompts.js`
- `scripts/generate-blog-posts.js`
- `lib/prompts/system-prompt.md`
- `lib/prompts/aistyleguide-style-guide.md`
- `BLOG_SYSTEM_README.md`
- `BLOG_SYSTEM_ROADMAP.md`
- `scripts/blog-topics-from-search-terms.csv`
- `supabase/migrations/001_create_blog_posts.sql`
- `lib/api-utils.ts`
- `app/api/webhook/route.ts`
- `app/brand-details/page.tsx`
- `app/api/process-abandoned-emails/route.ts`

**Assets (update when domain changes):**
- `public/logo-wordmark.svg`
- `aistyleguide-logo.svg`
- `components/Logo.tsx`

**Documentation:**
- `end-to-end-test-output.md`
- `outline.md`
- `FAVICON_RESEARCH.md`
- `scripts/generate-logo-svgs.js`

---

## Domain Decision (Pending)

**Current:** Using `aistyleguide.com` domain for all URLs and references.

**Action Items:**
- [ ] Decide on new domain for Fortress
- [ ] Update all URL references in codebase
- [ ] Set up 301 redirects from aistyleguide.com to new domain
- [ ] Update Google Search Console
- [ ] Update DNS and hosting configuration

---

## RESEND Domain Switch (Pending)

**Current:** Using `support@aistyleguide.com` as sender email.

**Action Items:**
- [ ] Choose new sender domain for Fortress
- [ ] Set up SPF/DKIM records for new domain
- [ ] Update RESEND configuration
- [ ] Update all email templates with new sender address
- [ ] Test email deliverability

---

