#!/usr/bin/env node
/**
 * Test: use Firecrawl search (site:domain) to grab first 3 links,
 * then feed their markdown to GPT-5.1 to report which URLs were used.
 *
 * Usage:
 *   pnpm node scripts/test-search-tofu.js https://stripe.com
 */

import dotenv from "dotenv"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import OpenAI from "openai"
import { searchBrief } from "../lib/firecrawl.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, "..", ".env.local") })

async function main() {
  const domain = process.argv[2]
  if (!domain) {
    console.error("Usage: pnpm node scripts/test-search-tofu.js <domain>")
    process.exit(1)
  }

  // Search Firecrawl with a site: query
  const searchQuery = `site:${new URL(domain).host}`
  const searchResult = await searchBrief(searchQuery, [], 10)

  if (!searchResult || !searchResult.markdown || searchResult.markdown.length === 0) {
    console.error("Search returned no markdown results")
    process.exit(1)
  }

  // Take first 3 markdown entries
  const top = searchResult.markdown.slice(0, 3)

  // Build prompt for GPT-5.1
  const pagesText = top
    .map((m, i) => `--- Page ${i + 1}: ${m.url || "unknown"} ---\n${m.markdown || ""}`)
    .join("\n\n")

  const prompt = `You are checking which URLs were gathered from a site search.\nReturn the list of URLs you see in the content below.\nReturn JSON with { "urls": string[] }.\n\n${pagesText}`

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 20000,
  })

  const resp = await openai.responses.create({
    model: "gpt-5.1",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "url_list",
        schema: {
          type: "object",
          properties: {
            urls: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 10,
            },
          },
          required: ["urls"],
          additionalProperties: false,
        },
      },
    },
  })

  if (resp.output_text) {
    console.log("GPT URLs:", resp.output_text)
  } else {
    console.log("No output from GPT.")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

