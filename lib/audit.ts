import { crawlSite, mapSite } from "./firecrawl"
import OpenAI from "openai"
import { z } from "zod"

// MVP: Simple, focused system prompt
const SYSTEM_PROMPT = `You are a content auditor. Find REAL inconsistencies in website content.

Focus on these 4 issue types only:
1. Terminology conflicts - Same concept called different names
2. Contradictory claims - Facts/numbers that don't match across pages
3. Voice inconsistencies - Formal vs casual tone switching
4. Naming conflicts - Product/brand names spelled differently

Rules:
- Only report OBJECTIVE issues with exact quote evidence
- High severity = would confuse users or damage trust
- Keep snippets SHORT (10-30 words max)
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
  
  try {
    const crawlResult = await crawlSite(domain, actualLimit)
    if (crawlResult.success && crawlResult.pages.length > 0) {
      // Convert markdown to plain text for audit analysis
      pages = crawlResult.pages.map(page => ({
        url: page.url,
        text: page.markdown || page.url // Use markdown content or fallback to URL
      }))
    } else {
      // Fallback: fetch homepage directly if Firecrawl fails
      console.warn(`Firecrawl crawl failed for ${domain}, fetching homepage directly:`, crawlResult.error)
      const homepageText = await fetchHomepageContent(domain)
      if (homepageText && homepageText.length > 200) {
        pages = [{ url: domain, text: homepageText }]
        console.log(`[Audit] Successfully fetched homepage content (${homepageText.length} chars)`)
      } else {
        console.error(`[Audit] Failed to fetch usable content from ${domain}`)
        throw new Error(`Unable to fetch content from ${domain}. The site may be blocking requests or taking too long to respond.`)
      }
    }
  } catch (error) {
    // Fallback: try to fetch homepage directly
    if (error instanceof Error && error.message.includes('Unable to fetch')) {
      throw error // Re-throw our validation error
    }
    console.warn(`Firecrawl crawl error for ${domain}, fetching homepage directly:`, error)
    const homepageText = await fetchHomepageContent(domain)
    if (homepageText && homepageText.length > 200) {
      pages = [{ url: domain, text: homepageText }]
      console.log(`[Audit] Successfully fetched homepage content (${homepageText.length} chars)`)
    } else {
      console.error(`[Audit] Failed to fetch usable content from ${domain}`)
      throw new Error(`Unable to fetch content from ${domain}. The site may be blocking requests or taking too long to respond.`)
    }
  }

  // Validate we have actual content before proceeding
  if (pages.length === 0 || pages.every(p => !p.text || p.text.length < 200)) {
    throw new Error(`No usable content found from ${domain}. Please check the URL and try again.`)
  }

  // Discover additional site URLs (non-scraped) for display
  let discoveredPages: { url: string; title?: string | null }[] = []
  try {
    const mapResult = await mapSite(domain, 20)
    if (mapResult.success && mapResult.pages.length > 0) {
      discoveredPages = mapResult.pages
      console.log(`[Audit] Discovered ${discoveredPages.length} pages via map`)
    }
  } catch (e) {
    console.warn(`[Audit] mapSite failed:`, e instanceof Error ? e.message : 'Unknown error')
  }

  const userPrompt = buildUserPrompt(domain, pages)
  
  try {
    // MVP: Use OpenAI Responses API directly with GPT-5
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Use responses API for structured output
    const response = await openai.responses.create({
      model: "gpt-5.1",
      input: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      reasoning: { effort: "low" },
      text: { 
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

    // Parse the JSON output
    const parsed = JSON.parse(response.output_text || "{}")
    
    // Validate with Zod schema
    const validated = AuditResultSchema.parse(parsed)
    
    console.log(`[Audit] Generated ${validated.groups?.length || 0} issue groups`)
    
    return {
      groups: validated.groups || [],
      pagesScanned: pages.length,
      discoveredPages,
    }
  } catch (error) {
    console.error("[Audit] Generation error:", error instanceof Error ? error.message : error)
    
    // Re-throw with user-friendly message
    if (error instanceof Error) {
      if (error.message.includes("content-filter")) {
        throw new Error("Content was blocked by safety filters. Try a different URL.")
      }
      throw error
    }
    throw new Error("Audit generation failed. Please try again.")
  }
}

// Keep old function name for backward compatibility
export async function auditSinglePage(domain: string): Promise<AuditResult> {
  return auditSite(domain, 1)
}



