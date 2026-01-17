# Prompt Update Required for PAID Tier Page Coverage

## Current Issue
PAID tier audits are only auditing 3 pages instead of 15-20 pages because the prompt doesn't specify tier-specific page counts.

## Solution
Update the OpenAI prompt to accept a `tier` variable and instruct different page counts based on tier.

## Prompt Update Instructions

### Step 1: Update Prompt in OpenAI Platform
Go to: https://platform.openai.com/prompts

Find prompt: `pmpt_695e4d1f54048195a54712ce6446be87061fc1380da21889` (version 15)

### Step 2: Add `tier` Variable
Add `tier` as a variable alongside `url`:
- Variables: `url`, `tier`

### Step 3: Update Prompt Text
Replace the page count instruction with tier-specific logic:

**OLD:**
```
Audit the homepage first, then up to 8 additional high-value pages (pricing, about, contact, key product/service pages).
```

**NEW:**
```
Audit the homepage first, then additional high-value pages based on tier:
- FREE tier ({{tier}} = "FREE"): Audit 1-2 additional pages (homepage + 1-2 key pages, ~3 pages total)
- PAID tier ({{tier}} = "PAID"): Audit 14-19 additional pages (homepage + 14-19 key pages, 15-20 pages total). Prioritize: pricing, about, contact, product/service pages, blog, FAQ, features, testimonials, case studies, resources, careers, etc.
- ENTERPRISE tier ({{tier}} = "ENTERPRISE"): Audit as many pages as needed for comprehensive coverage (use all available tool calls efficiently)

For PAID tier, you have up to 30 tool calls available. Use them efficiently to audit 15-20 distinct pages. Do not stop early - continue auditing until you've covered 15-20 pages or exhausted all available tool calls.
```

### Step 4: Update Code
After updating the prompt, update `lib/audit.ts` to pass the tier variable:

```typescript
// Line ~353
variables: {
  url: normalizedDomain,
  tier: tier // Add tier variable
}
```

### Step 5: Test
1. Run audit on remiperrichon.com
2. Verify it audits 15-20 pages
3. Verify tool calls are used efficiently (should use 25-30 tool calls)

## Expected Behavior After Fix
- **FREE**: 2-3 pages, ~5-8 tool calls
- **PAID**: 15-20 pages, ~25-30 tool calls  
- **ENTERPRISE**: 30+ pages, ~50-60 tool calls
