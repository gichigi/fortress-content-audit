import OpenAI from "openai"
import { z } from "zod"
import Logger from "./logger"

// ============================================================================
// Content Audit
// Uses GPT-5 with web_search for FREE tier (opens pages directly)
// For PAID/ENTERPRISE tiers: Deep Research API with web search/crawl
// ============================================================================

// Audit tiers for cost/scope control
// FREE tier uses GPT-5.1 with web_search (synchronous, opens pages directly)
// PAID/ENTERPRISE tiers use Deep Research API (background execution)
export const AUDIT_TIERS = {
  FREE: { maxToolCalls: 10, background: false, model: "gpt-5.1-2025-11-13" as const },
  PAID: { maxToolCalls: 50, background: true, model: "o4-mini-deep-research" as const },
  ENTERPRISE: { maxToolCalls: 100, background: true, model: "o3-deep-research" as const },
} as const

export type AuditTier = keyof typeof AUDIT_TIERS

// Content audit prompt - comprehensive and thorough
const AUDIT_PROMPT = `You're a world-class web content auditor. 

Find and report ALL content-related issues you can identify. Be thorough and comprehensive.
Don't limit yourself — report every issue you find, including minor ones.

If you find no issues, return an empty array.

For each issue, provide:
- Title, URL, snippet, suggested fix
- Category: 'typos', 'grammar', 'punctuation', 'seo', 'factual', 'links', 'terminology'
- Severity: 'low', 'medium', or 'high'

`

// Zod schemas for structured audit output
const AuditIssueLocationSchema = z.object({
  url: z.string(),
  snippet: z.string(),
})

const AuditIssueSchema = z.object({
  title: z.string(),
  category: z.string().optional(), // Optional: 'typos', 'grammar', 'seo', 'factual', 'links', 'terminology'
  severity: z.enum(["low", "medium", "high"]),
  impact: z.string().optional(),
  fix: z.string().optional(),
  locations: z.array(AuditIssueLocationSchema).min(1), // At least one location required
})

const AuditResultSchema = z.object({
  issues: z.array(AuditIssueSchema),
  pagesScanned: z.number(),
  auditedUrls: z.array(z.string()),
})

// Full audit result type (includes metadata)
export type AuditResult = z.infer<typeof AuditResultSchema> & {
  pagesScanned: number
  auditedUrls?: string[]
  responseId?: string
  status?: "completed" | "in_progress" | "queued" | "failed"
  tier?: AuditTier
  modelDurationMs?: number // Time taken for model to respond (in milliseconds)
  rawStatus?: string // Raw status from OpenAI API
  reasoningSummaries?: string[] // Reasoning summaries from the model's thinking process
}

// JSON schema for OpenAI structured output
const AUDIT_JSON_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },      // Specific, actionable
          category: { type: "string" },   // Optional: typos, grammar, seo, etc.
          severity: { type: "string", enum: ["low", "medium", "high"] },
          impact: { type: "string" },
          fix: { type: "string" },
          locations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                snippet: { type: "string" }
              },
              required: ["url", "snippet"]
            },
            minItems: 1
          }
        },
        required: ["title", "severity", "locations"]  // category optional
      }
    },
    pagesScanned: { type: "integer" },
    auditedUrls: { type: "array", items: { type: "string" } }
  },
  required: ["issues", "pagesScanned", "auditedUrls"]
}

// ============================================================================
// Helper functions
// ============================================================================

// Extract domain hostname for filtering
function extractDomainHostname(domain: string): string {
  try {
    const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    return url.hostname
  } catch {
    return domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

// ============================================================================
// Mini Audit - Free tier (GPT-5 with web_search)
// ============================================================================
export async function miniAudit(domain: string): Promise<AuditResult> {
  const tier = AUDIT_TIERS.FREE

  // Normalize domain URL
  const normalizedDomain = normalizeDomain(domain)
  const domainHostname = extractDomainHostname(normalizedDomain)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 300000, // 5min timeout
  })

  try {
    Logger.info(`[MiniAudit] Starting GPT-5 web_search audit for ${normalizedDomain}`)
    const modelStartTime = Date.now()
    
    const input = `${AUDIT_PROMPT}

Website to audit: ${normalizedDomain}

Instructions:
1. Open ONLY the homepage at ${normalizedDomain}
2. From the homepage, identify and open EXACTLY ONE key page (e.g., /about, /pricing, /product, /features, /docs)
3. Do NOT open any other pages - only homepage + 1 key page
4. Audit both pages and compare them for cross-page inconsistencies

Return your audit results as a JSON object with this structure:
{
  "issues": [
    {
      "title": "Issue title",
      "category": "typos|grammar|punctuation|seo|factual|links|terminology",
      "severity": "low|medium|high",
      "impact": "Impact description",
      "fix": "Suggested fix",
      "locations": [
        {
          "url": "<actual URL where issue was found>",
          "snippet": "<actual text/HTML showing the issue>"
        }
      ]
    }
  ],
  "pagesScanned": 2,
  "auditedUrls": ["<homepage URL>", "<key page URL>"]
}

Return ONLY valid JSON, no markdown code blocks.`

    Logger.debug(`[MiniAudit] Sending request to GPT-5.1 with web_search`)
    const params: any = {
      model: "gpt-5.1-2025-11-13",
      input: input,
      tools: [{
        type: "web_search",
        filters: {
          allowed_domains: [domainHostname]
        }
      }],
      max_tool_calls: tier.maxToolCalls, // Allow opening homepage + key pages
      max_output_tokens: 20000, // Increased for full JSON response
      include: ["web_search_call.action.sources"], // Include sources to get URLs
      text: {
        verbosity: "low"
      },
    }
    
    const response = await openai.responses.create(params)
    
    // Poll for completion if needed
    let status = response.status as string
    let finalResponse = response
    let attempts = 0
    const maxAttempts = 60 // 60 seconds max
    
    while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      finalResponse = await openai.responses.retrieve(response.id)
      status = finalResponse.status as string
      attempts++
      if (attempts % 10 === 0) {
        Logger.debug(`[MiniAudit] Status: ${status} (${attempts}s)`)
      }
    }
    
    const modelDurationMs = Date.now() - modelStartTime
    
    if (status !== "completed" && status !== "incomplete") {
      throw new Error(`Audit failed with status: ${status}`)
    }
    
    // Extract output text
    let outputText = finalResponse.output_text || ''
    
    // If output_text not directly available, try to extract from output array
    if (!outputText && Array.isArray(finalResponse.output)) {
      const messageItems = finalResponse.output.filter((item: any) => item.type === 'message' && (item as any).content && Array.isArray((item as any).content))
      for (const message of messageItems.reverse()) {
        const content = (message as any).content
        const textItems = content.filter((item: any) => item.type === 'output_text' && item.text)
        if (textItems.length > 0) {
          outputText = textItems[textItems.length - 1].text
          break
        }
      }
    }
    
    if (!outputText) {
      throw new Error("GPT-5.1 returned empty response")
    }
    
    // Extract opened pages for auditedUrls and count tool calls
    const openedPages: string[] = []
    let toolCallsUsed = 0
    if (finalResponse.output && Array.isArray(finalResponse.output)) {
      const webSearchCalls = finalResponse.output.filter((item: any) => item.type === 'web_search_call')
      toolCallsUsed = webSearchCalls.length
      webSearchCalls.forEach((call: any) => {
        if (call.action?.type === 'open_page' && call.action.url) {
          openedPages.push(call.action.url)
        }
      })
    }
    
    Logger.info(`[MiniAudit] Tool calls used: ${toolCallsUsed}/${tier.maxToolCalls} (${openedPages.length} pages opened)`)
    
    // Try to parse JSON from output
    let parsed: any
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: transform plain text to JSON
        Logger.debug(`[MiniAudit] Transforming output to structured JSON`)
        const structuredOutput = await transformToStructuredJSON(outputText, normalizedDomain)
        parsed = JSON.parse(structuredOutput)
      }
    } catch (parseError) {
      // Transform plain text to JSON
      Logger.debug(`[MiniAudit] Transforming output to structured JSON`)
      const structuredOutput = await transformToStructuredJSON(outputText, normalizedDomain)
      parsed = JSON.parse(structuredOutput)
    }
    
    // Validate with Zod schema
    const validated = AuditResultSchema.parse(parsed)
    
    // Use opened pages for auditedUrls if available, otherwise use parsed URLs
    const auditedUrls = openedPages.length > 0 ? openedPages : (validated.auditedUrls || [])
    
    Logger.info(`[MiniAudit] ✅ Complete: ${validated.issues.length} issues, ${validated.pagesScanned} pages, ${auditedUrls.length} URLs audited`)
    
    return {
      issues: validated.issues,
      pagesScanned: validated.pagesScanned,
      auditedUrls,
      status: "completed",
      tier: "FREE",
      modelDurationMs,
    }
  } catch (error) {
    Logger.error(`[MiniAudit] Error`, error instanceof Error ? error : undefined)
    throw handleAuditError(error)
  }
}

// ============================================================================
// Full Audit - Paid/Enterprise tier (deep crawl, background execution)
// ============================================================================
export async function auditSite(
  domain: string,
  tier: AuditTier = "PAID"
): Promise<AuditResult> {
  const tierConfig = AUDIT_TIERS[tier]

  // Normalize domain URL
  const normalizedDomain = normalizeDomain(domain)
  const domainForFilter = extractDomainForFilter(normalizedDomain)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: tierConfig.background ? 3600000 : 300000, // 1hr for background, 5min otherwise
  })

  // Build the research input prompt
  const pageGuidance = tier === "ENTERPRISE"
    ? "Crawl as many pages as needed to produce a comprehensive audit."
    : "Analyze up to 10-20 important pages (homepage, pricing, features, about, key product pages)."

  const input = `${AUDIT_PROMPT}

Website to audit: ${normalizedDomain}

${pageGuidance}

Look for:
- Cross-page inconsistencies in terminology, pricing, or product names
- Factual contradictions between different sections
- Grammar/spelling errors on key landing pages
- Outdated or conflicting information`

  try {
    // Use Deep Research model with background execution for paid tiers
    // Cast to any to allow params not yet in SDK typings
    const params: any = {
      model: tierConfig.model,
      input,
      tools: [{
        type: "web_search_preview",
        filters: {
          allowed_domains: [domainForFilter] // Restrict to target domain only
        }
      }],
      max_tool_calls: tierConfig.maxToolCalls, // Limit tool calls based on tier
      reasoning: { summary: "auto" },
      include: ["web_search_call.action.sources"], // Include sources to get all URLs consulted
      text: {
        verbosity: "low"
      },
    }
    if (tierConfig.background) {
      params.store = true
      params.background = true
    }
    
    const modelStartTime = Date.now()
    const response = await openai.responses.create(params)
    const modelDurationMs = Date.now() - modelStartTime
    
    // Verify model matches request
    const actualModel = response.model || params.model
    if (actualModel !== tierConfig.model) {
      console.error(`[Audit] ⚠️ MODEL MISMATCH: requested ${tierConfig.model}, got ${actualModel}`)
    }

    // Handle background execution (returns response ID for polling)
    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (tierConfig.background && (status === "queued" || status === "in_progress")) {
      return {
        issues: [],
        pagesScanned: 0,
        auditedUrls: [],
        responseId: response.id,
        status: "in_progress",
        tier,
        modelDurationMs,
      }
    }

    const transformedText = await transformToStructuredJSON(response.output_text || '', normalizedDomain)
    response.output_text = transformedText
    
    const result = parseAuditResponse(response, tier)
    return {
      ...result,
      modelDurationMs,
    }
  } catch (error) {
    console.error(`[Audit] Error:`, error instanceof Error ? error.message : error)
    throw handleAuditError(error)
  }
}

// ============================================================================
// Poll background audit status (for paid/enterprise tiers)
// ============================================================================
// Deep Research supports polling via responses.retrieve() per OpenAI API docs:
// https://platform.openai.com/docs/guides/deep-research
// When background=true, responses can be polled to check status (queued/in_progress/completed)
// and extract partial progress from output_text during processing
export async function pollAuditStatus(responseId: string, tier?: AuditTier): Promise<AuditResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  })

  try {
    // Poll Deep Research response status - supports queued/in_progress/completed states
    const response = await openai.responses.retrieve(responseId)

    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (status === "queued" || status === "in_progress") {
      // Try to extract progress info from partial response if available
      let pagesScanned = 0
      let auditedUrls: string[] = []
      let issues: any[] = []
      
      if (response.output_text) {
        try {
          const partial = JSON.parse(response.output_text)
          if (typeof partial.pagesScanned === 'number') {
            pagesScanned = partial.pagesScanned
          }
          if (Array.isArray(partial.auditedUrls)) {
            auditedUrls = partial.auditedUrls
          }
          // Extract issues count from partial response if available
          if (Array.isArray(partial.issues)) {
            issues = partial.issues
          }
        } catch {
          // Ignore parse errors for partial responses
        }
      }
      
      // Extract reasoning summaries from response output
      const reasoningSummaries = extractReasoningSummaries(response)
      
      return {
        issues,
        pagesScanned,
        auditedUrls,
        responseId,
        status: status === "queued" ? "queued" : "in_progress",
        rawStatus: status,
        reasoningSummaries,
      }
    }

    if (status === "completed" || (status === "incomplete" && response.incomplete_details?.reason === "max_output_tokens")) {
      // Handle both completed and incomplete (max_output_tokens) statuses
      const isIncomplete = status === "incomplete"
      
      // Extract output_text first (may be in message.content)
      let outputText = response.output_text
      if (!outputText && Array.isArray(response.output)) {
        const messageItems = (response.output as any[]).filter((item: any) => item.type === 'message' && Array.isArray(item.content))
        for (const message of messageItems.reverse()) {
          const textItems = (message.content as any[]).filter((item: any) => item.type === 'output_text' && item.text)
          if (textItems.length > 0) {
            outputText = textItems[textItems.length - 1].text
            break
          }
        }
      }
      
      // Transform plain text to structured JSON if needed
      if (outputText && !outputText.trim().startsWith('{')) {
        outputText = await transformToStructuredJSON(outputText, '')
        response.output_text = outputText
      } else if (!outputText && isIncomplete) {
        // If incomplete with no output_text, create empty structure
        response.output_text = JSON.stringify({ issues: [], pagesScanned: 0, auditedUrls: [] })
      } else if (outputText) {
        // Update response with extracted text
        response.output_text = outputText
      }
      
      const result = parseAuditResponse(response, tier || "PAID")
      // Extract actual crawled URLs from response output
      const actualCrawledUrls = extractCrawledUrls(response)
      if (actualCrawledUrls.length > 0) {
        result.auditedUrls = actualCrawledUrls
      }
      // Extract reasoning summaries from response output
      const reasoningSummaries = extractReasoningSummaries(response)
      result.reasoningSummaries = reasoningSummaries
      
      console.log(`[Audit] ✅ Complete: ${result.issues.length} issues, ${result.pagesScanned} pages, ${actualCrawledUrls.length} URLs audited`)
      return result
    }

    // Failed or cancelled
    console.error(`[Audit] Job failed or cancelled (${status}): ${responseId}`)
    console.error(`[Audit] Full response:`, JSON.stringify(response, null, 2))
    
    // Check if failure is due to model requiring verified org
    const error = response.error as any
    if (error?.code === 'model_not_found' || error?.message?.includes('verified')) {
      console.error(`[Audit] Model verification error during execution. Error: ${error?.message}`)
      // This can happen due to propagation delay even if org is verified
      // Provide a more helpful error message
      throw new Error("The audit failed due to a verification check during execution. This may be a temporary propagation delay. Please try again in a few minutes, or the system will automatically fall back to o4-mini on the next attempt.")
    }
    
    throw new Error(`Audit job failed with status: ${status}. ${error?.message || 'Please try again.'}`)
  } catch (error) {
    console.error(`[Audit] Poll error:`, error instanceof Error ? error.message : error)
    throw handleAuditError(error)
  }
}

// ============================================================================
// Transform plain text audit output to structured JSON using GPT-4o
// ============================================================================
async function transformToStructuredJSON(plainText: string, domain: string): Promise<string> {
  if (!plainText || plainText.trim().length === 0) {
    return JSON.stringify({ issues: [], pagesScanned: 0, auditedUrls: [] })
  }
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000, // 30s timeout for tight pipeline
  })

  const systemPrompt = `You are a JSON transformer. Convert audit findings from plain text to structured JSON. Extract real URLs and data from the text - never use placeholder or example values.`

  const userPrompt = `Convert this audit report to JSON. Extract all real URLs and data from the text:

${plainText}

Return ONLY valid JSON matching this exact structure:
{
  "issues": [
    {
      "title": "Issue title",
      "category": "typos|grammar|punctuation|seo|factual|links|terminology",
      "severity": "low|medium|high",
      "impact": "Impact description",
      "fix": "Suggested fix",
      "locations": [
        {
          "url": "<actual URL from text>",
          "snippet": "<actual text from audit>"
        }
      ]
    }
  ],
  "pagesScanned": <number>,
  "auditedUrls": ["<actual URLs from text>"]
}

CRITICAL RULES:
- Extract real URLs from the text - never use placeholders like "example.com"
- If no URLs are found in the text, use empty arrays
- Extract actual snippets showing the error
- Count pages scanned from the text
- Return ONLY valid JSON, no markdown code blocks
- If the text mentions "${domain}", use that as the base URL`

  try {
    const transformStart = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1, // Lower temperature for more consistent transformation
      response_format: { type: "json_object" },
      max_tokens: 4000, // Limit to ensure fast response
      verbosity: "low",
    })

    const transformed = response.choices[0]?.message?.content
    if (!transformed) {
      throw new Error("Transformation returned empty response")
    }

    // Validate it's valid JSON
    try {
      JSON.parse(transformed)
    } catch (parseError) {
      console.error(`[Transform] Invalid JSON returned, attempting to clean...`)
      const cleaned = cleanJsonResponse(transformed)
      JSON.parse(cleaned) // Validate cleaned version
      return cleaned
    }

    return transformed
  } catch (error) {
    console.error(`[Transform] ❌ Error:`, error instanceof Error ? error.message : error)
    // Don't fallback - throw error to fail fast in tight pipeline
    throw new Error(`Failed to transform audit output: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ============================================================================
// Helper functions
// ============================================================================

// Normalize domain to proper URL format
function normalizeDomain(domain: string): string {
  let url = domain.trim()
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`
  }
  try {
    const parsed = new URL(url)
    return parsed.origin
  } catch {
    throw new Error(`Invalid domain: ${domain}`)
  }
}

// Extract domain from URL for filtering (removes http/https, returns domain only)
function extractDomainForFilter(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.hostname // Returns just the domain, e.g., "vercel.com"
  } catch {
    // Fallback: try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/)
    return match ? match[1] : url
  }
}

// Validation helper for issues
function validateIssues(issues: any[]): void {
  issues.forEach((issue, idx) => {
    if (!Array.isArray(issue.locations) || issue.locations.length === 0) {
      console.warn(`[Audit] Issue ${idx} missing locations:`, issue.title)
    }
  })
}

// Clean JSON response - remove markdown code blocks and extract valid JSON
// Similar to lib/openai.ts cleanResponse() but optimized for audit responses
function cleanJsonResponse(text: string): string {
  // Remove markdown code block syntax if it exists
  text = text.replace(/```(json|markdown)?\n?/g, "").replace(/```\n?/g, "")
  
  // Remove any leading/trailing whitespace
  text = text.trim()
  
  // Find the start of JSON (either [ or {)
  const jsonStart = Math.min(
    text.indexOf('[') >= 0 ? text.indexOf('[') : Infinity,
    text.indexOf('{') >= 0 ? text.indexOf('{') : Infinity
  )
  
  if (jsonStart < Infinity) {
    // Try to parse from this point
    let jsonText = text.substring(jsonStart)
    
    // Try to find valid JSON by attempting to parse progressively smaller substrings
    // This handles cases where there's trailing text after the JSON
    for (let i = jsonText.length; i > 0; i--) {
      try {
        const candidate = jsonText.substring(0, i)
        const parsed = JSON.parse(candidate)
        // If parse succeeds, re-stringify to clean format
        return JSON.stringify(parsed)
      } catch (e) {
        // Continue trying shorter substrings
      }
    }
    
    // If we couldn't find valid JSON, fall back to regex extraction
    const arrayMatch = jsonText.match(/\[[\s\S]*\]/)
    const objectMatch = jsonText.match(/\{[\s\S]*\}/)
    
    if (arrayMatch) {
      return arrayMatch[0]
    } else if (objectMatch) {
      return objectMatch[0]
    }
  }
  
  // Fallback to original text if no JSON found
  return text
}

// Extract actual crawled URLs from Deep Research response output
// Extracts URLs from:
// 1. open_page actions (pages actually opened)
// 2. sources field (all URLs consulted during web search)
function extractCrawledUrls(response: any): string[] {
  const crawledUrls = new Set<string>()
  
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      // Extract URLs from web_search_call items that actually opened a page
      if (item.type === 'web_search_call' && item.action?.type === 'open_page') {
        const url = item.action?.url
        if (url && typeof url === 'string') {
          const cleanUrl = url.trim()
          if (cleanUrl && cleanUrl.startsWith('http') && !cleanUrl.includes('#:~:text=')) {
            const normalized = cleanUrl.replace(/\/+$/, '')
            crawledUrls.add(normalized)
          }
        }
      }
      
      // Extract URLs from sources field (all URLs consulted during web search)
      if (item.type === 'web_search_call' && item.action?.sources) {
        const sources = item.action.sources
        if (Array.isArray(sources)) {
          sources.forEach((source: any) => {
            // Sources can be objects with url field or strings
            const sourceUrl = typeof source === 'string' ? source : source.url || source
            if (sourceUrl && typeof sourceUrl === 'string') {
              const cleanUrl = sourceUrl.trim()
              if (cleanUrl && cleanUrl.startsWith('http') && !cleanUrl.includes('#:~:text=')) {
                const normalized = cleanUrl.replace(/\/+$/, '')
                crawledUrls.add(normalized)
              }
            }
          })
        }
      }
    }
  }
  
  return Array.from(crawledUrls).sort()
}

// Extract reasoning summaries from Deep Research response output
function extractReasoningSummaries(response: any): string[] {
  const summaries: string[] = []
  
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type === 'reasoning' && Array.isArray(item.summary)) {
        for (const summaryItem of item.summary) {
          if (summaryItem.type === 'summary_text' && summaryItem.text) {
            // Extract just the text content, removing markdown formatting
            const text = summaryItem.text.trim()
            if (text && !summaries.includes(text)) {
              summaries.push(text)
            }
          }
        }
      }
    }
  }
  
  return summaries
}

// Check if response indicates bot protection/firewall
function detectBotProtection(text: string): boolean {
  if (!text) return false
  
  const lowerText = text.toLowerCase()
  const botProtectionIndicators = [
    'cloudflare',
    'checking your browser',
    'please verify you are human',
    'verify you are human',
    'access denied',
    'bot protection',
    'firewall',
    'challenge page',
    'security check',
    'ddos protection',
    'just a moment',
    'ray id',
    'cf-ray',
    'unusual traffic',
    'automated access',
    'captcha',
    'recaptcha',
    'hcaptcha',
  ]
  
  return botProtectionIndicators.some(indicator => lowerText.includes(indicator))
}

// Parse and validate audit response from OpenAI
function parseAuditResponse(response: any, tier: AuditTier): AuditResult {
  // Extract output_text - SDK may provide it directly or we need to extract from output array
  let rawOutput = response.output_text
  
  // If output_text not directly available, try to extract from output array
  // Deep Research responses have structure: output[] -> message -> content[] -> output_text
  if (!rawOutput && Array.isArray(response.output)) {
    // Find message items with content
    const messageItems = response.output.filter((item: any) => item.type === 'message' && Array.isArray(item.content))
    for (const message of messageItems.reverse()) { // Check from last to first
      const textItems = message.content.filter((item: any) => item.type === 'output_text' && item.text)
      if (textItems.length > 0) {
        // Use the last output_text item from the last message (final response)
        rawOutput = textItems[textItems.length - 1].text
        break
      }
    }
  }
  
  if (!rawOutput) {
    console.error("[Audit] Response missing output_text")
    console.error("[Audit] Response structure:", JSON.stringify({
      has_output_text: !!response.output_text,
      output_array_length: Array.isArray(response.output) ? response.output.length : 0,
      output_types: Array.isArray(response.output) ? response.output.map((item: any) => item.type).slice(-5) : []
    }))
    throw new Error("AI model returned empty response. Please try again.")
  }

  // Check for bot protection indicators in response
  if (detectBotProtection(rawOutput)) {
    throw new Error("This site has bot protection enabled. The audit couldn't access the content. Try a different URL or contact support for assistance.")
  }

  let parsed: any
  
  // Attempt 1: Direct JSON parse
  try {
    parsed = JSON.parse(rawOutput)
  } catch (parseError) {
    // Attempt 2: Clean markdown and try again
    try {
      const cleaned = cleanJsonResponse(rawOutput)
      parsed = JSON.parse(cleaned)
    } catch (secondParseError) {
      console.error(`[Audit] JSON parse error:`, secondParseError instanceof Error ? secondParseError.message : "Unknown")
      console.error(`[Audit] Raw output (first 500 chars):`, rawOutput.substring(0, 500))
      throw new Error("AI model returned invalid JSON. Please try again.")
    }
  }

  // Validate with Zod schema
  let validated
  try {
    validated = AuditResultSchema.parse(parsed)
  } catch (zodError) {
    console.error("[Audit] Schema validation error:", zodError instanceof Error ? zodError.message : "Unknown")
    console.error("[Audit] Parsed JSON:", JSON.stringify(parsed, null, 2).substring(0, 1000))
    throw new Error("AI model returned data in unexpected format. Please try again.")
  }

  const pagesScanned = typeof validated.pagesScanned === "number" ? validated.pagesScanned : 0
  
  // Extract actual crawled URLs from response output (more accurate than text parsing)
  const actualCrawledUrls = extractCrawledUrls(response)
  const auditedUrls = actualCrawledUrls.length > 0 ? actualCrawledUrls : (Array.isArray(validated.auditedUrls) ? validated.auditedUrls : [])

  // Validate issues have locations
  validateIssues(validated.issues)

  return {
    issues: validated.issues,
    pagesScanned,
    auditedUrls,
    responseId: response.id,
    status: "completed",
    tier,
  }
}

// Map OpenAI errors to user-friendly messages
function handleAuditError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("Audit generation failed. Please try again.")
  }

  const msg = error.message.toLowerCase()

  // Bot protection detection (check first before other errors)
  if (detectBotProtection(msg)) {
    return new Error("This site has bot protection enabled. The audit couldn't access the content. Try a different URL or contact support for assistance.")
  }

  // Rate limits
  if (msg.includes("rate_limit") || msg.includes("429")) {
    return new Error("AI service is temporarily overloaded. Please wait a moment and try again.")
  }

  // Auth errors
  if (msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("authentication")) {
    console.error("[Audit] API key error - check OPENAI_API_KEY")
    return new Error("AI service authentication failed. Please contact support.")
  }

  // Timeout
  if (msg.includes("timeout") || msg.includes("etimedout") || msg.includes("aborted")) {
    return new Error("Request timed out. The site may be too large. Please try again.")
  }

  // Network
  if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("network")) {
    return new Error("Network error connecting to AI service. Please check your connection.")
  }

  // Content filter
  if (msg.includes("content-filter") || msg.includes("content_policy")) {
    return new Error("Content was blocked by safety filters. Try a different URL.")
  }

  // Model unavailable
  if (msg.includes("model") && (msg.includes("not found") || msg.includes("unavailable"))) {
    return new Error("AI model is temporarily unavailable. Please try again in a few minutes.")
  }

  // Pass through our custom errors (including bot protection error)
  if (msg.includes("bot protection") || msg.includes("ai model") || msg.includes("ai service") || msg.includes("invalid domain")) {
    return error
  }

  // Fallback
  return new Error("Audit generation failed. Please try again.")
}