import OpenAI from "openai"
import { z } from "zod"

// ============================================================================
// Deep Research Content Audit
// Uses OpenAI's Deep Research API with native web search/crawl capabilities.
// Pass a top-level domain; the agent auto-crawls and synthesizes issues.
// ============================================================================

// Audit tiers for cost/scope control
// Both tiers use deep research models; o4-mini is faster/cheaper for free tier
export const AUDIT_TIERS = {
  FREE: { maxToolCalls: 3, background: false, model: "o4-mini-deep-research" as const },
  PAID: { maxToolCalls: 25, background: true, model: "o3-deep-research" as const },
  ENTERPRISE: { maxToolCalls: 100, background: true, model: "o3-deep-research" as const },
} as const

export type AuditTier = keyof typeof AUDIT_TIERS

// Content audit prompt for Deep Research agent
const AUDIT_PROMPT = `Do a content audit to find all copy errors like typos, grammar mistakes, punctuation problems, and inconsistencies across numbers, facts/figures.

Also check for:
• Broken links (404s, 500s, redirect loops)
• SEO gaps: missing or duplicate title tags, meta descriptions, H1 tags, image alt text
• Inconsistent terminology, brand names, or product names

CRITICAL: Before auditing, verify pages have fully loaded. For JavaScript-rendered sites (React, Next.js, etc.), check the rendered DOM after JavaScript execution, not just the initial HTML.

Ignore anything subjective like tone of voice, SEO optimizations, or style preferences. We want to know where things are plain WRONG.

For each issue, provide:
- A specific, actionable title
- The page URL(s) where found
- A snippet showing the exact error
- A suggested fix
- Category: 'typos', 'grammar', 'punctuation', 'seo', 'factual', 'links', 'terminology'
- Severity: 'low', 'medium', or 'high'

Return findings as JSON with issues array, pagesScanned count, and auditedUrls array.`

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
  status?: "completed" | "in_progress" | "failed"
  tier?: AuditTier
  modelDurationMs?: number // Time taken for model to respond (in milliseconds)
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
// Mini Audit - Free tier (max 10 tool calls, fast, synchronous execution)
// ============================================================================
export async function miniAudit(domain: string): Promise<AuditResult> {
  console.log(`[MiniAudit] Starting free-tier audit for: ${domain}`)
  const tier = AUDIT_TIERS.FREE

  // Normalize domain URL
  const normalizedDomain = normalizeDomain(domain)
  console.log(`[MiniAudit] Normalized domain: ${normalizedDomain}`)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000, // 120s timeout for mini audit
  })

  const input = `${AUDIT_PROMPT}

Audit all public-facing pages on: ${normalizedDomain}

Use "site:${normalizedDomain}" search to discover pages. Prioritize key pages like homepage, pricing, about, and features.

Return ONLY valid JSON. Do not wrap in markdown code blocks. Return raw JSON starting with { and ending with }.

JSON structure:
{
  "issues": [{ "title": "...", "category": "typos|grammar|punctuation|seo|factual|links|terminology", "severity": "low|medium|high", "impact": "...", "fix": "...", "locations": [{"url": "...", "snippet": "..."}] }],
  "pagesScanned": N,
  "auditedUrls": ["url1", "url2", ...]
}`

  try {
    // Use deep research model with tool call limit for cost control
    const params: any = {
      model: tier.model, // Use model from config (o4-mini-deep-research for FREE)
      input,
      tools: [{ type: "web_search_preview" }],
      max_tool_calls: tier.maxToolCalls, // Limit to 3 tool calls for FREE tier
      // Note: o4-mini-deep-research doesn't support json_schema format,
      // so we rely on prompt engineering and parse JSON from output_text
      // The prompt already instructs JSON format, we'll parse it manually
    }
    if (tier.background) {
      params.background = true
    }
    
    // Track model call duration
    const modelStartTime = Date.now()
    console.log(`[MiniAudit] Using model ${tier.model} with max_tool_calls=${tier.maxToolCalls}, background=${tier.background}...`)
    
    const response = await openai.responses.create(params)
    
    const modelDurationMs = Date.now() - modelStartTime
    const actualModel = response.model || params.model
    console.log(`[MiniAudit] Model ${actualModel} responded in ${modelDurationMs}ms (max_tool_calls=${tier.maxToolCalls}, status=${response.status})`)

    // Handle background execution (returns response ID for polling)
    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (tier.background && (status === "queued" || status === "in_progress")) {
      console.log(`[MiniAudit] Background job started, ID: ${response.id}, status: ${response.status}`)
      return {
        issues: [],
        pagesScanned: 0,
        auditedUrls: [],
        responseId: response.id,
        status: "in_progress",
        tier: "FREE",
        modelDurationMs,
      }
    }

    console.log(`[MiniAudit] Response received, parsing...`)
    const result = parseAuditResponse(response, "FREE")
    return {
      ...result,
      modelDurationMs,
    }
  } catch (error) {
    console.error(`[MiniAudit] Error:`, error instanceof Error ? error.message : error)
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
  console.log(`[Audit] Starting ${tier} audit for: ${domain}`)
  const tierConfig = AUDIT_TIERS[tier]

  // Normalize domain URL
  const normalizedDomain = normalizeDomain(domain)
  console.log(`[Audit] Normalized domain: ${normalizedDomain}`)

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
- Outdated or conflicting information

Return your findings as JSON matching this structure:
{
  "issues": [{ "title": "...", "category": "typos|grammar|seo|factual|links|terminology" (optional), "severity": "low|medium|high", "impact": "...", "fix": "...", "locations": [{"url": "...", "snippet": "..."}] }],
  "pagesScanned": N,
  "auditedUrls": ["url1", "url2", ...]
}`

  try {
    // Use Deep Research model with background execution for paid tiers
    // Cast to any to allow params not yet in SDK typings
    const params: any = {
      model: tierConfig.model,
      input,
      tools: [{ type: "web_search_preview" }],
      max_tool_calls: tierConfig.maxToolCalls, // Limit tool calls based on tier
      reasoning: { summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: "audit_result",
          schema: AUDIT_JSON_SCHEMA,
        },
      },
    }
    if (tierConfig.background) {
      params.background = true
    }
    
    // Track model call duration
    const modelStartTime = Date.now()
    console.log(`[Audit] Calling model (tier: ${tier}, max_tool_calls=${tierConfig.maxToolCalls}, background=${tierConfig.background})...`)
    const response = await openai.responses.create(params)
    const modelDurationMs = Date.now() - modelStartTime
    console.log(`[Audit] Model responded in ${modelDurationMs}ms (tier: ${tier}, max_tool_calls=${tierConfig.maxToolCalls})`)

    // Handle background execution (returns response ID for polling)
    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (tierConfig.background && (status === "queued" || status === "in_progress")) {
      console.log(`[Audit] Background job started, ID: ${response.id}, status: ${response.status}`)
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

    console.log(`[Audit] Response received, parsing...`)
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
  console.log(`[Audit] Polling status for: ${responseId}${tier ? ` (tier: ${tier})` : ''}`)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  })

  try {
    // Poll Deep Research response status - supports queued/in_progress/completed states
    const response = await openai.responses.retrieve(responseId)

    // Log full response for debugging
    console.log(`[Audit] Poll response:`, {
      status: response.status,
      has_output_text: !!response.output_text,
      output_text_length: response.output_text?.length || 0,
      error: response.error,
      model: response.model,
    })

    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (status === "queued" || status === "in_progress") {
      console.log(`[Audit] Still running (${status}): ${responseId}`)
      // Try to extract progress info from partial response if available
      let pagesScanned = 0
      let auditedUrls: string[] = []
      if (response.output_text) {
        try {
          const partial = JSON.parse(response.output_text)
          if (typeof partial.pagesScanned === 'number') {
            pagesScanned = partial.pagesScanned
          }
          if (Array.isArray(partial.auditedUrls)) {
            auditedUrls = partial.auditedUrls
          }
        } catch {
          // Ignore parse errors for partial responses
        }
      }
      return {
        issues: [],
        pagesScanned,
        auditedUrls,
        responseId,
        status: "in_progress",
      }
    }

    if (status === "completed") {
      console.log(`[Audit] Completed: ${responseId}`)
      return parseAuditResponse(response, tier || "PAID")
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
        console.log(`[Audit] Extracted output_text from message.content (${textItems.length} text items found)`)
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

  const outputLength = rawOutput.length
  console.log(`[Audit] Parsing response (tier: ${tier}, length: ${outputLength} chars, responseId: ${response.id})`)
  
  // Log first/last 200 chars for debugging (if output is long enough)
  if (outputLength > 400) {
    console.log(`[Audit] Raw output preview (first 200):`, rawOutput.substring(0, 200))
    console.log(`[Audit] Raw output preview (last 200):`, rawOutput.substring(outputLength - 200))
  } else {
    console.log(`[Audit] Raw output:`, rawOutput)
  }

  let parsed: any
  let parseAttempt = 1
  
  // Attempt 1: Direct JSON parse
  try {
    parsed = JSON.parse(rawOutput)
    console.log(`[Audit] JSON parse succeeded on attempt ${parseAttempt} (direct parse)`)
  } catch (parseError) {
    console.warn(`[Audit] Direct JSON parse failed (attempt ${parseAttempt}), trying cleaned version...`)
    
    // Attempt 2: Clean markdown and try again
    try {
      const cleaned = cleanJsonResponse(rawOutput)
      parsed = JSON.parse(cleaned)
      console.log(`[Audit] JSON parse succeeded on attempt ${++parseAttempt} (after cleaning)`)
    } catch (secondParseError) {
      console.error(`[Audit] JSON parse error after cleaning:`, secondParseError instanceof Error ? secondParseError.message : "Unknown")
      console.error(`[Audit] Raw output (first 500 chars):`, rawOutput.substring(0, 500))
      console.error(`[Audit] Cleaned output (first 500 chars):`, cleanJsonResponse(rawOutput).substring(0, 500))
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
  const auditedUrls = Array.isArray(validated.auditedUrls) ? validated.auditedUrls : []

  // Validate issues have locations
  validateIssues(validated.issues)

  console.log(`[Audit] Parsed ${validated.issues.length} issues from ${pagesScanned} pages`)

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

  const msg = error.message

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
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("aborted")) {
    return new Error("Request timed out. The site may be too large. Please try again.")
  }

  // Network
  if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("network")) {
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

  // Pass through our custom errors
  if (msg.includes("AI model") || msg.includes("AI service") || msg.includes("Invalid domain")) {
    return error
  }

  // Fallback
  return new Error("Audit generation failed. Please try again.")
}