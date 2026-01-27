# Future Exploration: Multi-Model Synchronous Auditing

## Problem
Current audit flow uses a single GPT-5 model instance that serially processes the homepage and finds all issue types (Language, Facts & Consistency, Links & Formatting). This leads to:
- **Long audit times** - Model must analyze everything in one pass
- **Higher costs** - Single model instance with full token usage for all analysis types

## Proposed Solution
Run **multiple specialized model instances simultaneously** where each model focuses on a specific issue category:

```
Homepage audit
    ↓
Split into 3 parallel streams:
    ├─ Model A: Language & Grammar issues only
    ├─ Model B: Facts & Consistency issues only
    └─ Model C: Links & Formatting issues only
    ↓
Merge results back together
```

## Benefits

### Speed
- Parallelization reduces total time from ~60s to potentially ~20s (3x speedup)
- Each model has a narrower scope, potentially faster inference

### Cost Reduction
- Smaller, focused prompts = fewer tokens per model
- Could use smaller models (e.g., GPT-4 instead of GPT-5) for specific tasks
- 3 parallel smaller queries might cost less than 1 large query

### Quality
- Specialized models may catch category-specific issues better
- Less cognitive load per model = higher accuracy

## Open Questions

1. **Model selection**: Should we use different model sizes for different categories?
2. **Prompt optimization**: How to best instruct each model on its specific category?
3. **Error handling**: What if one model fails? Retry or continue with 2/3 results?
4. **Implementation complexity**: Worth the added code complexity for speed/cost gains?
5. **Tier strategy**: Apply to Pro tier first, then Free tier if successful?

## Test Script

A test script has been created to compare single-model vs parallel approaches:

```bash
pnpm test:parallel-audit <domain>
# Example: pnpm test:parallel-audit stripe.com
```

The script:
- Runs the current single-model mini audit
- Runs 3 parallel specialized models (one per category)
- Compares: run time, tokens, cost, issues found
- Saves results to JSON file for analysis

## Next Steps
- [x] Create test script for comparison (`scripts/test-parallel-audit.ts`)
- [ ] Run test on 5-10 different domains
- [ ] Analyze results for speed, cost, accuracy patterns
- [ ] Compare issue quality (are specialized models finding more/fewer/different issues?)
- [ ] Evaluate if gains justify implementation
- [ ] If promising, implement as production feature with tier gating
