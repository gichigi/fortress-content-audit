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
- Risk: elements intentionally hidden initially but shown via JS interaction (dropdowns, accordions, modals) may be stripped. Acceptable tradeoff — these rarely contain auditable content.
- The prompt-level caveats for whitespace remain as a safety net
