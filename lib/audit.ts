import { crawlSite, mapSite } from "./firecrawl"
import { OpenAI } from "openai"
import { z } from "zod"
import { zodResponseFormat } from "openai/helpers/zod"

const ONE_LINE_SYSTEM = "You are a forensic content auditor. Your job is to find REAL inconsistencies, contradictions, and actual problems in the content—not suggestions for improvement. Look for: conflicting information, inconsistent terminology, copy that contradicts itself, factual errors, and genuine content issues that would confuse or mislead readers."

// Zod schema for structured output
const AuditIssueExampleSchema = z.object({
  url: z.string(),
  snippet: z.string(),
})

const AuditIssueGroupSchema = z.object({
  title: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  impact: z.string(), // Why this matters (business consequence)
  fix: z.string(), // One clear actionable fix
  recommendations: z.array(z.string()), // Detailed steps (keep for detail view)
  examples: z.array(AuditIssueExampleSchema),
  count: z.number(),
})

const AuditResultSchema = z.object({
  groups: z.array(AuditIssueGroupSchema),
  top_findings: z.array(z.string()).nullable().optional(),
  summary: z.string(),
})

export type AuditResult = z.infer<typeof AuditResultSchema> & {
  pagesScanned: number
  discoveredPages?: { url: string; title?: string | null }[]
}

function buildUserPrompt(domain: string, pageBlobs: { url: string; text: string }[]) {
  const textBudget = 12000 // Increased to analyze more content per page
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

  return `You are a forensic content auditor. Find REAL inconsistencies, contradictions, and actual problems in the content below. Focus on issues that are OBJECTIVELY wrong or inconsistent—not subjective improvements.

Domain: ${domain}

Pages analyzed:
${included
  .map(
    (b) => `
URL: ${b.url}
TEXT:
${b.text}
`
  )
  .join("\n")}

Find ACTUAL problems and inconsistencies:

1. **Terminology Inconsistencies**: Same concept called different things (e.g., "workspace" vs "office" vs "space" for the same thing), inconsistent capitalization, different spellings of the same term
2. **Contradictory Information**: Claims that contradict each other across pages, conflicting numbers/statistics, opposing statements about the same thing
3. **Copy Duplication**: Identical or near-identical text appearing in multiple places (exact duplicates, not similar themes)
4. **Inconsistent Formatting**: Same type of content formatted differently (dates, prices, names, titles), inconsistent punctuation styles
5. **Factual Errors**: Numbers that don't add up, dates that conflict, claims that contradict each other
6. **Voice Contradictions**: Same page using both formal and informal voice for similar content, switching between first/second/third person inconsistently
7. **Conflicting CTAs**: Different pages directing users to do opposite things, competing calls-to-action
8. **Inconsistent Naming**: Product/service names spelled or capitalized differently, brand name variations
9. **Style Inconsistencies**: Same grammatical constructions used inconsistently (e.g., using contractions in some places but not others for similar content)
10. **Content Conflicts**: Information on one page that directly contradicts information on another page

CRITICAL: Only flag issues that are OBJECTIVELY inconsistent or contradictory. Do NOT suggest improvements or subjective "could be better" items. Focus on finding actual errors and inconsistencies.

Return JSON only with this shape:
{
  "groups": [
    {
      "title": "Specific inconsistency name (e.g., 'Product name spelled 3 different ways')",
      "severity": "low|medium|high",
      "impact": "Punchy 1-sentence business consequence (e.g. 'Confuses users and lowers trust', 'Creates legal ambiguity')",
      "fix": "The primary action to resolve this (e.g. 'Standardize on X')",
      "recommendations": ["Detailed step 1", "Detailed step 2"],
      "examples": [{"url": "string", "snippet": "Exact quote showing the inconsistency"}],
      "count": 3
    }
  ],
  "top_findings": ["Most significant inconsistency found", "Second most significant inconsistency"],
  "summary": "Brief 1-sentence overview of inconsistencies found. General, no brand names."
}

Rules:
- IMPACT is critical: Tell the user WHY they should care (lost money, lost trust, confusion).
- TITLE must be specific: "Contradictory Refund Policy" not "Policy Issues".
- Only report OBJECTIVE inconsistencies and contradictions.
- EXAMPLES: Extract ONLY the conflicting part (10-30 words max). Show the contradiction side-by-side if possible. Example: If "workspace" vs "office", show: "Our workspace..." and "The office..." - not full paragraphs.
- Snippets must be SHORT and highlight the actual inconsistency, not full context.
- High severity = contradictions that would confuse users or create legal/trust issues.
- Summary must be general and brief.
- Output VALID JSON only. No prose.`
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

export async function auditSite(domain: string, pageLimit: number = 5): Promise<AuditResult> {
  // Crawl site using Firecrawl (up to pageLimit pages)
  // For MVP, reduce to 3 pages to save credits
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
  
  // Use structured output with OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  try {
    // Use parse method if available, otherwise fall back to create with response_format
    let completion: any
    let parsed: any

    // Try parse method first (available in newer SDK versions)
    if (typeof (openai.chat.completions as any).parse === 'function') {
      completion = await (openai.chat.completions as any).parse({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: ONE_LINE_SYSTEM },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent, focused analysis
        max_tokens: 3000, // Increased for more detailed findings
        response_format: zodResponseFormat(AuditResultSchema, "audit_result"),
      })

      const message = completion.choices[0]?.message
      if (!message) {
        throw new Error("Empty response from OpenAI")
      }

      if (message.refusal) {
        throw new Error(`Model refused: ${message.refusal}`)
      }

      if (!message.parsed) {
        throw new Error("Failed to parse structured output")
      }

      parsed = message.parsed
    } else {
      // Fallback to regular create with response_format
      completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: ONE_LINE_SYSTEM },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent, focused analysis
        max_tokens: 3000, // Increased for more detailed findings
        response_format: zodResponseFormat(AuditResultSchema, "audit_result"),
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error("Empty response from OpenAI")
      }

      // Parse the JSON response
      try {
        parsed = JSON.parse(content)
        // Validate with Zod schema
        parsed = AuditResultSchema.parse(parsed)
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }
    }
    
    return {
      groups: parsed.groups || [],
      top_findings: parsed.top_findings || [],
      summary: parsed.summary || "",
      pagesScanned: pages.length,
      discoveredPages,
    }
  } catch (error) {
    // Check for OpenAI-specific errors
    if (error && typeof error === 'object' && 'constructor' in error) {
      const errorName = error.constructor.name
      if (errorName === 'LengthFinishReasonError' || errorName.includes('Length')) {
        throw new Error("Response truncated due to length")
      }
      if (errorName === 'ContentFilterFinishReasonError' || errorName.includes('ContentFilter')) {
        throw new Error("Response blocked by content filter")
      }
    }
    
    // Re-throw with better error message
    if (error instanceof Error) {
      throw error
    }
    throw new Error(error ? String(error) : "Audit generation failed")
  }
}

// Keep old function name for backward compatibility
export async function auditSinglePage(domain: string): Promise<AuditResult> {
  return auditSite(domain, 1)
}



