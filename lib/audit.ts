import { crawlSite, mapSite, scrapeUrl, searchBrief } from "./firecrawl"
import OpenAI from "openai"
import { z } from "zod"

// MVP: Simple, focused system prompt
const SYSTEM_PROMPT = `You are a world-class digital content auditor. Audit the following website for content inconsistencies.

- Ignore all spacing/formatting/layout issues (missing/extra spaces). 
- Return valid JSON only`

// Zod schema for structured output (use .nullable() for OpenAI compatibility)
const AuditIssueExampleSchema = z.object({
  url: z.string(),
  snippet: z.string(),
})

const AuditIssueGroupSchema = z.object({
  title: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  impact: z.string(),
  fix: z.string(),
  examples: z.array(AuditIssueExampleSchema),
  count: z.number(),
})

const AuditResultSchema = z.object({
  groups: z.array(AuditIssueGroupSchema),
})

export type AuditResult = z.infer<typeof AuditResultSchema> & {
  pagesScanned: number
  discoveredPages?: { url: string; title?: string | null }[]
  auditedUrls?: string[]
  mapInfo?: { count: number; error?: string | null }
}

const isLocalePrefixed = (path: string) => {
  // Match /fr/, /fr-be/, /en-us/, etc.
  const first = path.split("/").filter(Boolean)[0]
  return !!first && /^[a-z]{2}(-[a-z]{2})?$/i.test(first)
}

export async function selectImportantUrls(
  domain: string,
  discovered: { url: string; title?: string | null }[],
  desiredCount: number
): Promise<string[]> {
  const host = new URL(domain).host
  const candidates: { url: string; title?: string | null }[] = []
  const seen = new Set<string>()

  const pathDepth = (path: string) => {
    const parts = path.split("/").filter(Boolean)
    return parts.length
  }

  const add = (u?: string, t?: string | null) => {
    if (!u) return
    try {
      const parsed = new URL(u)
      if (parsed.host !== host) return
      // Skip locale-prefixed variants to reduce duplicate homepages
      if (isLocalePrefixed(parsed.pathname)) return
      const href = parsed.href
      if (seen.has(href)) return
      seen.add(href)
      candidates.push({ url: href, title: t || null })
    } catch {}
  }

  // Always include the root domain first
  add(domain)
  for (const p of discovered) {
    add(p.url, p.title)
  }

  // Sort by path depth then length to surface top-level TOFU pages first
  candidates.sort((a, b) => {
    const pa = new URL(a.url).pathname
    const pb = new URL(b.url).pathname
    const depthDiff = pathDepth(pa) - pathDepth(pb)
    if (depthDiff !== 0) return depthDiff
    return pa.length - pb.length
  })

  // If very few, just return what we have
  if (candidates.length <= desiredCount) {
    return candidates.map((c) => c.url)
  }

  // Try lightweight model selection
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20000,
    })

    const listText = candidates
      .map((c, i) => `${i + 1}. ${c.title ? `${c.title} - ` : ""}${c.url}`)
      .join("\n")

    const prompt = `Select the ${desiredCount} most important user-facing pages for a quick content audit.
Prioritize the pages most likely to be visited first (top-of-funnel): 
the main overview/landing
clear value/offer pages
pricing/plans if present
trust/credibility
the most recent major announcement
and a prominent beginner entry point.

Use URL slug patterns to identify TOFU pages:
- Prioritize URLs with slugs like: /pricing, /products, /solutions, /features, /demo, /signup, /free-trial, /contact, /get-started, /about, /learn, /how-it-works, /company, /overview, /platform, /customer-stories, /testimonials, /compare, /industries
- Avoid URLs with slugs like: /blog, /resources, /legal, /docs, /terms, /privacy, /support, /faq, /careers, /events, /api, /sitemap (unless no other TOFU options exist)

Avoid deep technical/reference/how-to pages unless there are no strong TOFU options. 
Return ONLY a JSON array of URLs from the list below. Do not invent URLs.

Pages:
${listText}`

    const resp = await openai.responses.create({
      model: "gpt-4.1",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "url_list",
          schema: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: desiredCount,
          },
        },
      },
    })

    if (resp.output_text) {
      const parsed = JSON.parse(resp.output_text)
      if (Array.isArray(parsed)) {
        const selected: string[] = []
        for (const u of parsed) {
          try {
            const href = new URL(u).href
            if (seen.has(href) && selected.length < desiredCount) {
              selected.push(href)
            }
          } catch {}
        }
        if (selected.length > 0) return selected.slice(0, desiredCount)
      }
    }
  } catch (err) {
    console.warn("[Audit] URL selection fallback (model error):", err instanceof Error ? err.message : err)
  }

  // Fallback: first N candidates by path length (shorter first)
  const sorted = [...candidates].sort((a, b) => (a.url.length || 0) - (b.url.length || 0))
  return sorted.slice(0, desiredCount).map((c) => c.url)
}

// MVP: Build simple user prompt with page content
function buildUserPrompt(domain: string, pageBlobs: { url: string; text: string }[]) {
  const textBudget = 25000 // Increased for 10-page scans
  let used = 0
  const included: { url: string; text: string }[] = []
  for (const b of pageBlobs) {
    if (!b.text) continue
    const remain = textBudget - used
    if (remain <= 0) break
    const slice = b.text.slice(0, Math.max(0, remain))
    included.push({ url: b.url, text: slice })
    used += slice.length
  }

  // Zod schema handles JSON structure - just provide content
  return `Audit this website for content inconsistencies.

Domain: ${domain}

Pages analyzed:
${included.map((b) => `--- ${b.url} ---\n${b.text}`).join("\n\n")}`
}

async function fetchHomepageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FortressBot/1.0)'
      },
      signal: AbortSignal.timeout(7000) // 7 second timeout (keeps total under 10s)
    })
    
    if (!response.ok) {
      console.warn(`[Audit] Homepage fetch returned status ${response.status}`)
      return ''
    }
    
    const html = await response.text()
    
    console.log(`[Audit] Fetched HTML: ${html.length} chars, content-type: ${response.headers.get('content-type')}`)
    
    if (!html || html.length < 100) {
      console.warn(`[Audit] Homepage content too short (${html?.length || 0} chars)`)
      return ''
    }
    
    // Try to extract text content from HTML
    // First, try to get text from common content containers
    let text = ''
    
    // Try extracting from common semantic tags first
    const contentSelectors = [
      /<main[^>]*>([\s\S]*?)<\/main>/gi,
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<section[^>]*>([\s\S]*?)<\/section>/gi,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<body[^>]*>([\s\S]*?)<\/body>/gi
    ]
    
    for (const selector of contentSelectors) {
      const matches = html.match(selector)
      if (matches && matches.length > 0) {
        text += matches.join(' ') + ' '
      }
    }
    
    // If no semantic content found, extract from entire HTML
    if (text.length < 200) {
      text = html
    }
    
    // Clean up the text
    text = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '') // Remove SVGs
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ')
      .trim()
    
    console.log(`[Audit] Extracted text: ${text.length} chars`)
    
    // Only return if we got substantial content
    if (text.length < 200) {
      console.warn(`[Audit] Extracted text too short (${text.length} chars), HTML was ${html.length} chars`)
      // Log a sample of the HTML to debug
      console.log(`[Audit] HTML sample (first 500 chars):`, html.substring(0, 500))
      return ''
    }
    
    return text.substring(0, 15000) // Increased to 15k chars for better analysis
  } catch (error) {
    console.warn(`[Audit] Failed to fetch homepage:`, error instanceof Error ? error.message : 'Unknown error')
    return ''
  }
}

export async function auditSite(domain: string, pageLimit: number = 3): Promise<AuditResult> {
  // Temp: limit to 3 pages for faster testing
  const actualLimit = Math.min(pageLimit, 3)
  let pages: { url: string; text: string }[] = []
  let discoveredPages: { url: string; title?: string | null }[] = []
  const auditedUrls: string[] = []
  let mapInfo: { count: number; error?: string | null } = { count: 0, error: null }
  const seenPages = new Set<string>()

  const addPage = (url: string, text?: string | null) => {
    if (!url || !text || text.length < 200) return
    const key = new URL(url).href
    if (seenPages.has(key)) return
    seenPages.add(key)
    pages.push({ url: key, text })
    auditedUrls.push(key)
  }

  // First try Firecrawl search (site:<domain>) to grab top URLs directly
  try {
    const host = new URL(domain).host
    const searchLimit = Math.max(actualLimit * 3, 10)
    const searchResult = await searchBrief(`site:${host}`, [], searchLimit)
    console.log(`[Audit] searchBrief returned ${Array.isArray(searchResult?.markdown) ? searchResult.markdown.length : 0} entries (limit ${searchLimit})`)
    if (searchResult?.markdown && Array.isArray(searchResult.markdown)) {
      for (const entry of searchResult.markdown) {
        if (!entry?.url) continue
        const entryUrl = new URL(entry.url)
        if (entryUrl.host !== host) continue
        if (isLocalePrefixed(entryUrl.pathname)) continue
        const text = entry.markdown || (entry as any).content
        if (!text || text.length < 200) {
          console.log(`[Audit] searchBrief entry skipped (too short): ${entryUrl.href} (${text?.length || 0} chars)`)
          continue
        }
        addPage(entryUrl.href, text)
        if (pages.length >= actualLimit) break
      }
      console.log(`[Audit] searchBrief added ${pages.length} pages (desired ${actualLimit})`)
    }
  } catch (e) {
    console.warn("[Audit] searchBrief failed, falling back to map/crawl:", e instanceof Error ? e.message : e)
  }

  // If search filled the quota, skip map/select/crawl
  if (pages.length >= actualLimit) {
    console.log(`[Audit] Search provided ${pages.length} pages, skipping map/crawl`)
  } else {
    try {
      // Map the site to pick a small, relevant set of URLs (homepage + top discovered)
      try {
        const mapResult = await mapSite(domain, 500)
        if (mapResult.success && mapResult.pages.length > 0) {
          // Drop blog posts from selection to focus on TOFU/marketing/docs
          const filtered = mapResult.pages.filter((p) => !p.url.includes("/blog/"))
          discoveredPages = filtered
          mapInfo = { count: filtered.length, error: null }
          console.log(`[Audit] Discovered ${discoveredPages.length} pages via map (filtered blog)`)
        } else {
          mapInfo = { count: 0, error: mapResult.error || 'map returned no pages' }
          console.warn(`[Audit] mapSite returned no pages: ${mapResult.error || 'unknown'}`)
        }
      } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error'
          mapInfo = { count: 0, error: msg }
          console.warn(`[Audit] mapSite failed:`, msg)
      }

      const targets = await selectImportantUrls(domain, discoveredPages, actualLimit)
      for (const url of targets) {
        if (seenPages.has(new URL(url).href)) continue
        const scrapeResult = await scrapeUrl(url)
        if (scrapeResult.success && scrapeResult.markdown && scrapeResult.markdown.length > 200) {
          addPage(url, scrapeResult.markdown)
        } else {
          console.warn(`[Audit] Firecrawl scrape failed for ${url}, trying direct fetch:`, scrapeResult.error)
          const text = await fetchHomepageContent(url)
          addPage(url, text)
        }
        if (pages.length >= actualLimit) break
      }

      // Fallback to Firecrawl crawl if we failed to collect pages
      if (pages.length === 0) {
        const crawlResult = await crawlSite(domain, actualLimit)
        if (crawlResult.success && crawlResult.pages.length > 0) {
          for (const page of crawlResult.pages) {
            addPage(page.url, page.markdown || page.url)
            if (pages.length >= actualLimit) break
          }
        } else {
          console.warn(`Firecrawl crawl failed for ${domain}, fetching homepage directly:`, crawlResult.error)
          const homepageText = await fetchHomepageContent(domain)
          addPage(domain, homepageText)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unable to fetch')) {
        throw error
      }
      console.warn(`Audit page collection error for ${domain}:`, error)
      const homepageText = await fetchHomepageContent(domain)
      addPage(domain, homepageText)
    }
  }

  // Validate we have actual content before proceeding
  if (pages.length === 0 || pages.every(p => !p.text || p.text.length < 200)) {
    throw new Error(`No usable content found from ${domain}. Please check the URL and try again.`)
  }

  const userPrompt = buildUserPrompt(domain, pages)
  
  try {
    // MVP: Use OpenAI Responses API directly with GPT-5
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120000, // 2 minute timeout
    })

    // Use responses API for structured output
    const response = await openai.responses.create({
      model: "gpt-5.1",
      input: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      reasoning: { effort: "low" },
      text: {
        // Verbosity is supported by the API; cast to satisfy current types if needed
        // @ts-expect-error openai typings may not yet expose verbosity
        verbosity: "low",
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

    // Validate response has output_text
    if (!response.output_text) {
      console.error("[Audit] OpenAI response missing output_text")
      throw new Error("AI model returned empty response. Please try again.")
    }

    // Parse the JSON output with error handling
    let parsed: any
    try {
      parsed = JSON.parse(response.output_text)
    } catch (parseError) {
      console.error("[Audit] JSON parse error:", parseError instanceof Error ? parseError.message : 'Unknown')
      console.error("[Audit] Raw output_text (first 500 chars):", response.output_text.substring(0, 500))
      throw new Error("AI model returned invalid JSON. Please try again.")
    }
    
    // Validate with Zod schema
    let validated
    try {
      validated = AuditResultSchema.parse(parsed)
    } catch (zodError) {
      console.error("[Audit] Zod validation error:", zodError instanceof Error ? zodError.message : 'Unknown')
      console.error("[Audit] Parsed JSON:", JSON.stringify(parsed, null, 2))
      throw new Error("AI model returned data in unexpected format. Please try again.")
    }
    
    console.log(`[Audit] Generated ${validated.groups?.length || 0} issue groups`)
    
    return {
      groups: validated.groups || [],
      pagesScanned: pages.length,
      discoveredPages,
    auditedUrls,
    mapInfo,
    }
  } catch (error) {
    console.error("[Audit] Generation error:", error instanceof Error ? error.message : error)
    
    // Handle OpenAI API specific errors
    if (error instanceof Error) {
      // Rate limit errors
      if (error.message.includes("rate_limit") || error.message.includes("429")) {
        throw new Error("AI service is temporarily overloaded. Please wait a moment and try again.")
      }
      
      // Authentication errors
      if (error.message.includes("401") || error.message.includes("invalid_api_key") || error.message.includes("authentication")) {
        console.error("[Audit] API key error - check OPENAI_API_KEY")
        throw new Error("AI service authentication failed. Please contact support.")
      }
      
      // Timeout errors
      if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT") || error.message.includes("aborted")) {
        throw new Error("Request timed out. The site may be too large. Please try again or use a smaller site.")
      }
      
      // Network errors
      if (error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND") || error.message.includes("network")) {
        throw new Error("Network error connecting to AI service. Please check your connection and try again.")
      }
      
      // Content filter errors
      if (error.message.includes("content-filter") || error.message.includes("content_policy")) {
        throw new Error("Content was blocked by safety filters. Try a different URL.")
      }
      
      // Model unavailable errors
      if (error.message.includes("model") && (error.message.includes("not found") || error.message.includes("unavailable"))) {
        throw new Error("AI model is temporarily unavailable. Please try again in a few minutes.")
      }
      
      // JSON/parsing errors (already handled above, but catch any remaining)
      if (error.message.includes("JSON") || error.message.includes("parse")) {
        throw error // Re-throw our custom JSON error messages
      }
      
      // Re-throw our custom error messages
      if (error.message.includes("AI model") || error.message.includes("AI service")) {
        throw error
      }
      
      // Unknown OpenAI API errors
      if (error.constructor.name === "APIError" || error.message.includes("OpenAI")) {
        throw new Error("AI service error. Please try again in a moment.")
      }
    }
    
    // Fallback for unknown errors
    throw new Error("Audit generation failed. Please try again.")
  }
}




