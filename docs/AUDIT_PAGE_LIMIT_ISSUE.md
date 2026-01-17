# Audit Page Limit Issue - remiperrichon.com

## Problem
PAID tier audits are only auditing 3 pages instead of the expected 15-20 pages.

## Investigation Results

### Audit Run: `7361002c-55cb-4aa2-bd39-c9e843a61668`
- **Domain**: remiperrichon.com
- **Tier**: PAID
- **Pages Audited**: 3
- **Issues Found**: 0
- **Tool Calls Used**: 5/30 (only 16% of available)
- **Audited URLs**: Same homepage URL repeated 3 times
  - `https://www.remiperrichon.com/`
  - `https://www.remiperrichon.com/`
  - `https://www.remiperrichon.com/`

### Root Cause
1. **Prompt Limitation**: The current prompt (version 15) likely instructs "up to 8 additional pages" (9 total), which is insufficient for PAID tier
2. **Early Stopping**: Model is using only 5/30 tool calls and stopping early
3. **Duplicate URLs**: Same homepage URL appears 3 times, suggesting the model may be retrying or confused

### Current Configuration
- **PAID Tier**: `maxToolCalls: 30` (allows up to 30 tool calls)
- **Prompt ID**: `pmpt_695e4d1f54048195a54712ce6446be87061fc1380da21889`
- **Prompt Version**: 15
- **Expected Pages**: 15-20 pages (per pricing page)

### Solution Required
Update the OpenAI prompt to explicitly instruct PAID tier to:
1. Audit 15-20 key pages (not just 8 additional)
2. Use all available tool calls efficiently
3. Prioritize important pages: homepage, pricing, about, contact, product/service pages, blog, FAQ, etc.

### Prompt Update Needed
The prompt should include tier-specific instructions:
- **FREE**: Homepage + 1-2 key pages (up to 10 tool calls)
- **PAID**: Homepage + 14-19 additional pages (15-20 total, up to 30 tool calls)
- **ENTERPRISE**: Full site analysis (up to 60 tool calls)

### Action Items
1. ✅ Documented the issue
2. ⏳ Update OpenAI prompt (version 16) with tier-specific page counts
3. ⏳ Test with remiperrichon.com after prompt update
4. ⏳ Verify tool calls are being used efficiently
