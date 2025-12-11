#!/usr/bin/env node
/**
 * Search-based audit test:
 * - Firecrawl search (site:<domain>) to get top results (markdown)
 * - Take first 3 URLs
 * - Feed markdown to GPT-5.1 with the audit schema/prompt
 *
 * Usage:
 *   pnpm node scripts/test-search-audit.js https://example.com
 */

import dotenv from "dotenv"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import OpenAI from "openai"
import { searchBrief } from "../lib/firecrawl.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, "..", ".env.local") })

const SYSTEM_PROMPT = `You are a world-class digital content auditor. Find only the following issues in website content:

Spelling/grammar/typos
Naming, terminology, factual conflicts
Contradictory claims

Rules:
- Ignore all spacing/formatting/layout issues (missing/extra spaces, carousels/repeated grids, nav/footers/consent UI).
- Only report issues where you have high confidence
- Return valid JSON only`

function buildUserPrompt(domain, pageBlobs) {
  const textBudget = 25000
  let used = 0
  const included = []
  for (const b of pageBlobs) {
    if (!b.text) continue
    const remain = textBudget - used
    if (remain <= 0) break
    const slice = b.text.slice(0, Math.max(0, remain))
    included.push({ url: b.url, text: slice })
    used += slice.length
  }

  return `Audit this website for content inconsistencies.

Domain: ${domain}

Pages analyzed:
${included.map((b) => `--- ${b.url} ---\n${b.text}`).join("\n\n")}`
}

async function main() {
  const domainArg = process.argv[2]
  if (!domainArg) {
    console.error("Usage: pnpm node scripts/test-search-audit.js <domain>")
    process.exit(1)
  }
  const host = new URL(domainArg).host
  const searchQuery = `site:${host}`

  const searchResult = await searchBrief(searchQuery, [], 10)
  if (!searchResult || !searchResult.markdown || searchResult.markdown.length === 0) {
    console.error("Search returned no markdown results")
    process.exit(1)
  }

  const top = searchResult.markdown
    .filter((m) => m.url && new URL(m.url).host === host)
    .slice(0, 3)
  if (top.length === 0) {
    console.error("No host-matching URLs in search results")
    process.exit(1)
  }

  const pages = top.map((m) => ({
    url: m.url,
    text: m.markdown || m.content || "",
  }))

  const userPrompt = buildUserPrompt(domainArg, pages)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000,
  })

  const response = await openai.responses.create({
    model: "gpt-5.1",
    input: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "audit_result",
        schema: {
          type: "object",
          properties: {
            groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  impact: { type: "string" },
                  fix: { type: "string" },
                  examples: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        snippet: { type: "string" },
                      },
                      required: ["url", "snippet"],
                      additionalProperties: false,
                    },
                  },
                  count: { type: "number" },
                },
                required: ["title", "severity", "impact", "fix", "examples", "count"],
                additionalProperties: false,
              },
            },
          },
          required: ["groups"],
          additionalProperties: false,
        },
      },
    },
  })

  console.log(
    JSON.stringify(
      {
        domain: domainArg,
        urls: pages.map((p) => p.url),
        groups: response.output_text ? JSON.parse(response.output_text).groups : [],
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

