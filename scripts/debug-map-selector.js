import { mapSite } from "../lib/firecrawl.js"
import OpenAI from "openai"

/**
 * Debug helper: maps a domain and runs the same selection prompt
 * used in audit, without crawling or auditing content.
 *
 * Usage:
 *   pnpm node scripts/debug-map-selector.js https://example.com [limit]
 */

function isLocalePrefixed(path) {
  const first = path.split("/").filter(Boolean)[0]
  return !!first && /^[a-z]{2}(-[a-z]{2})?$/i.test(first)
}

function pathDepth(path) {
  return path.split("/").filter(Boolean).length
}

async function selectImportantUrls(domain, discovered, desiredCount) {
  const host = new URL(domain).host
  const candidates = []
  const seen = new Set()

  const add = (u, t) => {
    if (!u) return
    try {
      const parsed = new URL(u)
      if (parsed.host !== host) return
      if (isLocalePrefixed(parsed.pathname)) return
      const href = parsed.href
      if (seen.has(href)) return
      seen.add(href)
      candidates.push({ url: href, title: t || null })
    } catch {
      // ignore bad URLs
    }
  }

  // always include root
  add(domain)
  for (const p of discovered) {
    add(p.url, p.title || null)
  }

  // sort by path depth then length
  candidates.sort((a, b) => {
    const pa = new URL(a.url).pathname
    const pb = new URL(b.url).pathname
    const depthDiff = pathDepth(pa) - pathDepth(pb)
    if (depthDiff !== 0) return depthDiff
    return pa.length - pb.length
  })

  if (candidates.length <= desiredCount) {
    return candidates.map((c) => c.url)
  }

  const listText = candidates
    .map((c, i) => `${i + 1}. ${c.title ? `${c.title} - ` : ""}${c.url}`)
    .join("\n")

  // Debug: check if target URLs are present and see sort order
  console.log("--- Candidate List (First 20) ---")
  console.log(listText.split("\n").slice(0, 20).join("\n"))
  console.log("---------------------------------")
  
  const pricingUrl = candidates.find(c => c.url.includes("/pricing"))
  console.log("Has pricing URL?", pricingUrl ? "Yes: " + pricingUrl.url : "No")

  const prompt = `Select the ${desiredCount} most important user-facing pages for a quick content audit.
Prioritize the pages most likely to be visited first (top-of-funnel): 
the main overview/landing
clear value/offer pages
pricing/plans if present
trust/credibility
the most recent major announcement
and a prominent beginner entry point.

Avoid deep technical/reference/how-to pages unless there are no strong TOFU options. 
Return ONLY a JSON array of URLs from the list below. Do not invent URLs.

Pages:
${listText}`

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const resp = await openai.responses.create({
    model: "gpt-4.1",
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
              maxItems: desiredCount,
            },
          },
          required: ["urls"],
          additionalProperties: false,
        },
      },
    },
  })

  if (resp.output_text) {
    const parsed = JSON.parse(resp.output_text)
    if (parsed && Array.isArray(parsed.urls)) {
      const selected = []
      for (const u of parsed.urls) {
        try {
          const href = new URL(u).href
          if (seen.has(href) && selected.length < desiredCount) {
            selected.push(href)
          }
        } catch {
          // ignore parse errors
        }
      }
      if (selected.length > 0) return selected.slice(0, desiredCount)
    }
  }

  // fallback: first N by depth/length
  return candidates.slice(0, desiredCount).map((c) => c.url)
}

async function main() {
  const domain = process.argv[2]
  const limit = Number(process.argv[3] || 500)

  if (!domain) {
    console.error("Usage: pnpm node scripts/debug-map-selector.js <domain> [limit]")
    process.exit(1)
  }

  const mapResult = await mapSite(domain, limit)
  if (!mapResult.success) {
    console.error("Map failed:", mapResult.error)
    process.exit(1)
  }

  const selected = await selectImportantUrls(domain, mapResult.pages, 3)

  const titleMap = new Map()
  for (const p of mapResult.pages) {
    try {
      const href = new URL(p.url).href
      if (!titleMap.has(href)) {
        titleMap.set(href, p.title || null)
      }
    } catch {
      // ignore bad URLs
    }
  }

  const selectedWithTitles = selected.map((u) => ({
    url: u,
    title: titleMap.get(u) || null,
  }))

  console.log(JSON.stringify({
    domain,
    mappedCount: mapResult.pages.length,
    selectedCount: selected.length,
    selected,
    selectedWithTitles,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

