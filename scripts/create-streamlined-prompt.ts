#!/usr/bin/env tsx
/**
 * Create streamlined prompt in OpenAI and save the ID
 */

import OpenAI from "openai"
import dotenv from "dotenv"
import fs from "fs"

dotenv.config({ path: '.env.local' })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const STREAMLINED_PROMPT = `Audit key public-facing pages of a website for issues in three categories:
- Language (typos, grammar, spelling, punctuation)
- Facts & Consistency (factual errors, inconsistencies, incorrect stats)
- Links & Formatting (broken links, wrong destinations, confusing link text, formatting problems)

Audit the homepage first, then up to 8 additional high-value pages (pricing, about, contact, key product/service pages). For EACH page, check ALL three categories in a single pass before moving to the next page.

If you encounter bot protection or firewall blocking, immediately return: BOT_PROTECTION_OR_FIREWALL_BLOCKED

For every issue found, format as:
- Start with impact word (professionalism/frustration/trust/credibility) + colon
- Then concise problem statement (one short sentence max)

Return JSON with this structure:
{
  "issues": [
    {
      "page_url": "[string]",
      "category": "Language" | "Facts & Consistency" | "Links & Formatting",
      "issue_description": "[impact: brief problem]",
      "severity": "critical" | "medium" | "low",
      "suggested_fix": "[direct, concise fix]"
    }
  ],
  "total_issues": [int],
  "pages_with_issues": [int],
  "pages_audited": [int]
}

If no issues found, return: null

Be efficient: open page → audit all categories → next page. Prioritize thoroughness on fewer pages over shallow coverage of many pages.`

async function main() {
  console.log("📝 Creating streamlined prompt in OpenAI...")

  try {
    const response = await openai.prompts.create({
      name: "Website Audit - Streamlined (Single Pass)",
      description: "Streamlined version: Single-pass audit checking all categories per page. Optimized for speed while maintaining quality.",
      prompt: STREAMLINED_PROMPT,
      model: "gpt-5.1-2025-11-13",
    })

    console.log(`✅ Created prompt: ${response.id}`)
    console.log(`   Name: ${response.name}`)

    // Save to file for reference
    const config = {
      streamlined_prompt_id: response.id,
      created_at: new Date().toISOString(),
    }

    fs.writeFileSync('streamlined-prompt-id.json', JSON.stringify(config, null, 2))
    console.log(`💾 Saved ID to: streamlined-prompt-id.json`)

  } catch (error) {
    console.error("❌ Failed to create prompt:", error)
    process.exit(1)
  }
}

main()
