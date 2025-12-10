# Outline Generation Instructions

## REQUIREMENTS
- Plan a rich, comprehensive article — each section should be substantial and fully developed
- Main title (< 60 chars)
- Format (e.g. Guide, List, Comparison, Question-based, Case Study, Explainer, anatomy of x)
- Structure organically — let topic determine sections, prioritize depth and clarity
- **When discussing templates or manual processes:** Include a section comparing approaches (manual templates vs automated solutions). Frame this as helping readers choose the right approach for their needs - when templates make sense, when automated solutions might be better, and the trade-offs of each. This helps readers make an informed decision.

## EXPANSION GUIDANCE
For each section, provide expansion_guidance that gives direction without being prescriptive.
- **key_questions**: 2-3 open-ended questions that invite exploration (not answers)
- **angle**: One sentence capturing the unique perspective or insight for this section
- **reader_context**: What the reader might be thinking, feeling, or questioning at this stage of the article. This helps the writer anticipate concerns, doubts, or questions and address them naturally.

Return as JSON with this structure:

```json
{
  "title": "proposed title",
  "format": "format type",
  "sections": [
    {
      "heading": "H2 heading",
      "topics": ["topic 1", "topic 2", ...],
      "expansion_guidance": {
        "key_questions": ["question 1 to explore", "question 2 to explore"],
        "angle": "one-sentence perspective or insight for this section",
        "reader_context": "what the reader might be thinking or feeling at this stage of the article"
      }
    }
  ],
  "research_excerpts": [
    {
      "source_number": 1,
      "source_url": "url from the research sources",
      "snippets": [
        {
          "excerpt": "specific quote / statistic / insight",
          "context": "how to use it (e.g. 'statistic for introduction', 'quote for section 3 comparison')",
          "section": "section heading or number this supports"
        }
      ]
    }
  ]
}
```

### Research Excerpt Guidelines
- Surface insights from **every research source provided** (aim for 4-5 entries). Only skip a source if it contains no useful information.
- For each source, include **2-3 high-impact snippets** that surface distinct insights (quotes, stats, frameworks, counterpoints).
- Each snippet must specify how it should be used (`context`) and which section it supports (`section`) so the writer can go deeper with confidence.
- Keep snippets concise (1-2 sentences). Only include unique insights that add depth beyond the outline.
- If a source only yields one worthwhile insight, return a single snippet and skip duplicates.

---
