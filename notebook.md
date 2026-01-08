--
**Testing notes**

# dash
finalise sidebar

## pricing
will be rewritten

## other
update metadata to reflect this project not aistyleguide
create simple logo
re-enable daily audit limit for plans & paid plan temporary override in route.ts
- deslop

Remove domain email and twitter handle for aistyleguide

Suggestions for High-Quality Non-SEO Content Issues
1. Category-Specific Prompts (High Impact)
Instead of one broad audit, run separate focused passes:
Pass 1: Factual consistency (compare pricing/features across pages)
Pass 2: Grammar/spelling (systematic text review)
Pass 3: Broken links (follow every href)
Why: O3 tends to do shallow coverage on everything vs deep coverage on priorities. Focused prompts produce better results per category.
2. Explicit Comparison Instructions (High Impact)
Tell O3 to create a "truth table" first:
"First, extract all pricing mentioned on the site"
"Then, list all product names used"
"Finally, check for conflicts between pages"
Why: Cross-page issues (the highest value findings) require the model to hold information across pages. Explicit extraction forces this.
3. Provide Reference Data (Medium Impact)
If available, give O3 known facts to verify:
Company founding date
Current pricing
Product names/features
Why: Models are better at verification than discovery. Giving it checkpoints increases accuracy.
4. Snippet Extraction Phase (Medium Impact)
Add a post-processing step where GPT-4.1 re-verifies each issue:
"Is this snippet actually showing an error?"
"Does this URL exist?"
"Is this a false positive from responsive design?"
Why: Reduces hallucinated issues significantly.
Suggestions for Auditing More Pages
1. Sitemap Injection (High Impact)
Before O3 runs, fetch the sitemap.xml and inject URLs:
These are all pages on the site: [list from sitemap]You MUST visit at least 20 of these.
Why: Removes discovery burden from O3, guarantees coverage.
2. Multi-Turn Browsing (High Impact)
After initial audit completes, send a follow-up:
"You visited [X pages]. Visit 10 more pages you haven't seen yet."
Continue until target coverage reached.
Why: O3 self-limits per request but can be pushed to continue.
3. Page Quota Enforcement (Medium Impact)
Add explicit counting requirement:
"You have a quota of 20 page opens. Use all of them."
"After each page, report: 'Page X/20 complete'"
Why: Makes the model track its own progress.
4. Hybrid Approach (Medium Impact)
Use Puppeteer to pre-crawl all internal links (not just homepage), then feed O3 a curated list of 30-40 URLs to choose from.
Why: Better URL coverage than homepage-only extraction.
My Recommendation
Start with #1 (Category-Specific Prompts) + #1 from Page Coverage (Sitemap Injection). These are highest ROI for quality and coverage without major code changes.
Want me to implement any of these?