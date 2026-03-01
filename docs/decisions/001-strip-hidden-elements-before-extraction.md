# ADR-001: Strip hidden DOM elements before Firecrawl markdown extraction

**Date:** 2026-02-28
**Status:** Accepted
**Context:** Content extraction accuracy

## Problem

Firecrawl's HTML-to-markdown conversion produces two types of false positives:

1. **Responsive duplicates** — Sites render the same content for desktop and mobile breakpoints using CSS visibility classes (e.g., Tailwind's `hidden lg:block`). Both versions appear in the markdown, causing models to flag "duplicate CTAs", "duplicate banners", etc. On seline.com, this caused 3/21 false positives.

2. **Whitespace artifacts** — Adjacent HTML elements (e.g., `<span>The</span><span>simple</span>`) lose their spacing in markdown, producing merged text like `Thesimple`. This caused 6/21 false positives on seline.com.

Combined, these artifacts produced a 40-60% false positive rate on some sites.

## Decision

Use Firecrawl's `executeJavascript` action to strip hidden elements from the DOM before markdown extraction. The script runs in the real browser context where `getComputedStyle` correctly resolves all CSS (including Tailwind, media queries, etc.), removing elements that are `display: none`, `visibility: hidden`, or have zero height.

This solves responsive duplicates at the source — before Firecrawl converts to markdown.

Whitespace artifacts are handled separately via prompt-level caveats in `lib/audit-prompts.ts`.

## Updates

### 2026-03-01: sr-only and aria-hidden stripping

Screen-reader-only elements (Tailwind's `.sr-only`, `.visually-hidden`) and `aria-hidden="true"` elements were appearing in the extracted markdown. Example: a comparison table cell showing "YesYes" because the sr-only text "Yes" was concatenated with the visible "Yes".

The `executeJavascript` script now strips these in two phases:
1. **By selector** — `.sr-only`, `.visually-hidden`, `[aria-hidden="true"]`
2. **By computed style** — `position:absolute` + `overflow:hidden` + dimensions <=1px (catches clip-based hiding patterns)

### 2026-03-01: Element manifest restored from HTML

Firecrawl scrape now requests `html` format alongside `markdown` and `links`. The adapter (`lib/firecrawl-adapter.ts`) parses the HTML with cheerio to build a structured element manifest listing links (with type: internal/mailto/tel/external), buttons, and interactive widgets (chat, modals). This is appended to each page's content in the prompt.

This restores the ability for models to cross-reference interactive elements — e.g., confirming a "live chat" link is backed by a real chat widget, or verifying whether a link actually exists on the page. Previously lost when we moved from the legacy manifest-extractor to Firecrawl markdown.

### 2026-03-01: AI link checking removed, HTTP crawler expanded

AI models can't reliably judge link destinations from markdown — they don't understand product context (e.g., a homepage link that scrolls to a scan section looks "wrong" to the model). Link checking is now split:

- **HTTP link crawler** (`lib/link-crawler.ts`) — checks all internal links for HTTP errors (404, 500, timeouts). Deterministic and reliable.
- **AI models** — focus on language, facts, and formatting/UX only. All link-related instructions removed from prompts.

The crawler also now checks ALL internal links, not just links to audited pages. And `scrapePage` uses `onlyMainContent: false` so nav/footer links are included.

### 2026-03-01: SPA fallback for page discovery

Firecrawl's `map` endpoint does a lightweight fetch that misses client-rendered SPA content (the HTML is empty until JavaScript runs). When map returns fewer than 5 URLs, the adapter scrapes the homepage in a real browser to discover links, then merges them into the URL list. No extra API calls for server-rendered sites.

## Alternatives considered

### A. Prompt-level fix only (previously implemented)
- Added caveats to all audit prompts telling models to ignore spacing artifacts
- Worked for whitespace but models still flagged responsive duplicates
- Kept as supplementary defense

### B. Browserless BQL with `visible: true`
- Browserless offers a `text` API with `visible: true` flag that only returns visible text
- Also has `viewport` parameter and built-in bot protection bypass
- Would replace Firecrawl entirely — cleaner architecture but bigger migration
- **Noted as future option** if Firecrawl limitations persist or if we need more control

### C. Parse HTML with cheerio, strip hidden elements ourselves
- Get `html` format from Firecrawl, parse with cheerio, remove hidden elements, convert to markdown with turndown
- Full control but adds two dependencies and a custom conversion pipeline
- More fragile than letting the browser resolve CSS

### D. Send raw HTML to models instead of markdown
- Models can read HTML with class attributes
- 3-5x more tokens — significantly higher cost
- Rejected for cost reasons

### E. Structured JSON output
- Firecrawl's JSON mode works on markdown internally, not HTML — can't see CSS classes
- Building our own JSON from HTML is essentially option C with extra steps

## Consequences

- Firecrawl scrape calls now include an `executeJavascript` action
- Elements hidden via CSS at the default 1920px viewport are removed before extraction
- sr-only and aria-hidden elements are also stripped
- Risk: elements intentionally hidden initially but shown via JS interaction (dropdowns, accordions, modals) may be stripped. Acceptable tradeoff — these rarely contain auditable content.
- The prompt-level caveats for whitespace remain as a safety net
- Link checking is fully automated via HTTP crawler; AI models no longer assess links
- SPA sites get a fallback homepage scrape for page discovery when map fails
