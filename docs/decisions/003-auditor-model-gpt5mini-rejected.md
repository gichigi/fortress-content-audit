# ADR-003: Auditor model selection — gpt-5-mini rejected, gpt-5.1 confirmed

**Date:** 2026-03-13
**Status:** Rejected
**Context:** Cost reduction on Pro tier auditor pass

## Problem

Pro tier costs ~$0.93-1.14/site. Auditor accounts for ~30% of that (3 calls × ~$0.17-0.21/call at gpt-5.1 pricing). gpt-5-mini is ~12% of gpt-5.1 input cost ($0.25/M vs $2.00/M output). The hypothesis was that mini is good enough for a high-recall liberal auditing pass because the checker (gpt-5.1) acts as the quality gate downstream.

## Product priority context

**Quality > Cost > Speed.** Users lose trust when the tool produces inconsistent or unreliable results across audits. It is better to find fewer issues confidently than to produce variable output.

## What was tested

Two eval runs with gpt-5-mini auditor, gpt-5.1 checker, across 4 benchmark sites (secondhome.io, justcancel.io, youform.com, seline.so).

### Cost results (favourable)
- Auditor cost: ~$0.028-0.035/call (6-7x cheaper)
- Total per-site: ~$0.49-0.54 (55% reduction vs gpt-5.1)

### Quality results (unfavourable)

| Site | gpt-5.1 unique issues | mini Run 4a | mini Run 4b | Variance |
|------|----------------------|-------------|-------------|----------|
| secondhome.io | 35 | 27 | 60 | **2.2x swing** |
| justcancel.io | 28 | 37 | 45 | 1.2x |
| youform.com | 20 | 14 | 27 | **1.9x swing** |
| seline.so | 37 | 38 | 39 | stable |

**Facts & Consistency was especially unstable:**

| Site | gpt-5.1 F&C | mini Run 4a F&C | mini Run 4b F&C |
|------|------------|----------------|----------------|
| secondhome.io | 18 | 9 | 3 |
| youform.com | 12 | 4 | 9 |

F&C is the highest-value category (pricing contradictions, FAQ mismatches, cross-page inconsistencies). These are the issues users care most about. mini found 50-80% fewer F&C issues and the numbers were inconsistent between runs.

Checker rejection rate also increased 10-15x vs gpt-5.1 (13-25 rejections/site vs 0-10), confirming mini produces noisier auditor output that the checker must clean up.

## Decision

**Rejected.** gpt-5-mini is not suitable for the Pro auditor pass.

- Run-to-run variance is unacceptable for a quality-first product. A user auditing the same site twice could get 14 issues one week and 60 the next.
- F&C drop is a category-level quality failure, not just noise.
- The 55% cost reduction does not offset the reliability risk.

**gpt-5.1-2025-11-13 remains the auditor model** for both the Pro tier and the eval script.

## Future cost reduction options (not yet attempted)

1. **Strip repeated nav/footer across pages** — same nav appears on every page, wasting tokens on each auditor call. Deduplication could save 10-20%. Medium risk (need to verify detection reliability isn't affected).
2. **Cheaper checker model** — checker now dominates cost (~70-80% of total). A cheaper model for the checker (with gpt-5.1 as fallback for uncertain cases) could have more impact than a cheaper auditor.
3. **Prompt caching improvements** — currently barely fires on parallel calls. If OpenAI adds manual cache control (like Anthropic's `cache_control`), the manifest prefix could be cached explicitly.
