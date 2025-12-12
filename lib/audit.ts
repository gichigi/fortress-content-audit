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
  FREE: { maxToolCalls: 5, background: false, model: "o4-mini-deep-research" as const },
  PAID: { maxToolCalls: 25, background: true, model: "o3-deep-research" as const },
  ENTERPRISE: { maxToolCalls: 100, background: true, model: "o3-deep-research" as const },
} as const

export type AuditTier = keyof typeof AUDIT_TIERS

// Content audit prompt for Deep Research agent
const AUDIT_PROMPT = `You are a world-class website content auditor.

Your task: Crawl and audit the website for content quality issues.

Focus ONLY on objective content errors:
• Typos and spelling mistakes (only if certain)
• Grammar errors (incorrect grammar, not style preferences)
• Punctuation errors (missing periods, commas, apostrophes)
• Factual contradictions (e.g., "100 users" in one place, "200 users" in another)
• Inconsistent terminology for the same concept (e.g., "customer" vs "client")
• Incorrect/inconsistent brand names or product names
• Duplicate content with conflicting information

Do NOT report:
• Spacing issues, formatting artifacts, collapsed words
• UI/layout issues (you cannot see visual rendering)
• Responsive breakpoint duplicates
• Navigation/footer/header repetition
• Style preferences or subjective opinions
• Missing headings or weak CTAs

For each issue found, provide:
1. The page URL where the issue was found
2. A short snippet showing the exact error
3. A suggested fix

Be thorough but precise. Only report issues you are certain about.
Crawl multiple pages to find cross-site inconsistencies.`

// Zod schemas for structured audit output
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

// Full audit result type (includes metadata)
export type AuditResult = z.infer<typeof AuditResultSchema> & {
  pagesScanned: number
  auditedUrls?: string[]
  responseId?: string
  status?: "completed" | "in_progress" | "failed"
  tier?: AuditTier
}

// JSON schema for OpenAI structured output
const AUDIT_JSON_SCHEMA = {
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
    pagesScanned: { type: "number" },
    auditedUrls: { type: "array", items: { type: "string" } },
  },
  required: ["groups", "pagesScanned"],
  additionalProperties: false,
}

// ============================================================================
// Mini Audit - Free tier (3 pages max, fast, no background)
// ============================================================================
export async function miniAudit(domain: string): Promise<AuditResult> {
  console.log(`[MiniAudit] Starting free-tier audit for: ${domain}`)
  const tier = AUDIT_TIERS.FREE

  // Normalize domain URL
  const normalizedDomain = normalizeDomain(domain)
  console.log(`[MiniAudit] Normalized domain: ${normalizedDomain}`)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 90000, // 90s timeout for mini audit
  })

  const input = `${AUDIT_PROMPT}

Website to audit: ${normalizedDomain}

IMPORTANT: This is a quick audit. Analyze up to 3 pages maximum.
Focus on the homepage and 2 other key pages (pricing, about, or features if available).
Return high-signal issues only.

Return your findings as JSON matching this structure:
{
  "groups": [{ "title": "...", "severity": "low|medium|high", "impact": "...", "fix": "...", "examples": [{"url": "...", "snippet": "..."}], "count": N }],
  "pagesScanned": N,
  "auditedUrls": ["url1", "url2", ...]
}`

  try {
    // Use deep research model with tool call limit for cost control
    const params: any = {
      model: tier.model,
      input,
      tools: [{ type: "web_search_preview" }],
      max_tool_calls: tier.maxToolCalls,
      reasoning: { summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: "audit_result",
          schema: AUDIT_JSON_SCHEMA,
        },
      },
    }
    const response = await openai.responses.create(params)

    console.log(`[MiniAudit] Response received, parsing...`)
    return parseAuditResponse(response, "FREE")
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
  "groups": [{ "title": "...", "severity": "low|medium|high", "impact": "...", "fix": "...", "examples": [{"url": "...", "snippet": "..."}], "count": N }],
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
      max_tool_calls: tierConfig.maxToolCalls,
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
    const response = await openai.responses.create(params)

    // Handle background execution (returns response ID for polling)
    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (tierConfig.background && (status === "queued" || status === "in_progress")) {
      console.log(`[Audit] Background job started, ID: ${response.id}, status: ${response.status}`)
      return {
        groups: [],
        pagesScanned: 0,
        responseId: response.id,
        status: "in_progress",
        tier,
      }
    }

    console.log(`[Audit] Response received, parsing...`)
    return parseAuditResponse(response, tier)
  } catch (error) {
    console.error(`[Audit] Error:`, error instanceof Error ? error.message : error)
    throw handleAuditError(error)
  }
}

// ============================================================================
// Poll background audit status (for paid/enterprise tiers)
// ============================================================================
export async function pollAuditStatus(responseId: string): Promise<AuditResult> {
  console.log(`[Audit] Polling status for: ${responseId}`)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  })

  try {
    const response = await openai.responses.retrieve(responseId)

    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (status === "queued" || status === "in_progress") {
      console.log(`[Audit] Still running (${status}): ${responseId}`)
      return {
        groups: [],
        pagesScanned: 0,
        responseId,
        status: "in_progress",
      }
    }

    if (status === "completed") {
      console.log(`[Audit] Completed: ${responseId}`)
      return parseAuditResponse(response, "PAID")
    }

    // Failed or cancelled
    console.error(`[Audit] Job failed or cancelled (${status}): ${responseId}`)
    throw new Error("Audit job failed. Please try again.")
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

// Parse and validate audit response from OpenAI
function parseAuditResponse(response: any, tier: AuditTier): AuditResult {
  if (!response.output_text) {
    console.error("[Audit] Response missing output_text")
    throw new Error("AI model returned empty response. Please try again.")
  }

  let parsed: any
  try {
    parsed = JSON.parse(response.output_text)
  } catch (parseError) {
    console.error("[Audit] JSON parse error:", parseError instanceof Error ? parseError.message : "Unknown")
    console.error("[Audit] Raw output (first 500 chars):", response.output_text.substring(0, 500))
    throw new Error("AI model returned invalid JSON. Please try again.")
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

  const pagesScanned = typeof parsed.pagesScanned === "number" ? parsed.pagesScanned : 0
  const auditedUrls = Array.isArray(parsed.auditedUrls) ? parsed.auditedUrls : []

  console.log(`[Audit] Parsed ${validated.groups.length} issue groups from ${pagesScanned} pages`)

  return {
    groups: validated.groups,
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
