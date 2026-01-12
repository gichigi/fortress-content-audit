import OpenAI from "openai"
import { z } from "zod"
import Logger from "./logger"

// ============================================================================
// Content Audit
// All tiers use GPT-5.1 with web_search (synchronous, opens pages directly)
// Tier differences: maxToolCalls and page guidance
// ============================================================================

// Audit tiers for cost/scope control
// All tiers use GPT-5.1 with web_search (synchronous, opens pages directly)
// Tier differences: maxToolCalls and page guidance
export const AUDIT_TIERS = {
  FREE: { maxToolCalls: 10, background: false, model: "gpt-5.1-2025-11-13" as const },
  PAID: { maxToolCalls: 50, background: false, model: "gpt-5.1-2025-11-13" as const },
  ENTERPRISE: { maxToolCalls: 100, background: false, model: "gpt-5.1-2025-11-13" as const },
} as const

export type AuditTier = keyof typeof AUDIT_TIERS

// Reusable OpenAI prompt ID for content audits
// Set via OPENAI_AUDIT_PROMPT_ID env var or use default
const AUDIT_PROMPT_ID = process.env.OPENAI_AUDIT_PROMPT_ID || "pmpt_695e4d1f54048195a54712ce6446be87061fc1380da21889"
const AUDIT_PROMPT_VERSION = process.env.OPENAI_AUDIT_PROMPT_VERSION || "13"

// Mini audit prompt ID for free tier (1 audit pass, no reasoning summaries for faster processing)
// Set via OPENAI_MINI_AUDIT_PROMPT_ID env var or use default
const MINI_AUDIT_PROMPT_ID = process.env.OPENAI_MINI_AUDIT_PROMPT_ID || "pmpt_695fd80f94188197ab2151841cf20d6a00213764662a5853"
const MINI_AUDIT_PROMPT_VERSION = process.env.OPENAI_MINI_AUDIT_PROMPT_VERSION || "3"

// Zod schemas for structured audit output (new prompt format)
const NewPromptIssueSchema = z.object({
  page_url: z.string(),
  category: z.enum(["Language", "Facts & Consistency", "Links & Formatting"]),
  issue_description: z.string(),
  severity: z.enum(["low", "medium", "critical"]),
  suggested_fix: z.string(),
})

const NewPromptResultSchema = z.object({
  issues: z.array(NewPromptIssueSchema),
  total_issues: z.number().optional(),
  pages_with_issues: z.number().optional(),
  pages_audited: z.number().optional(),
})

// Legacy schemas removed - using new prompt format directly

const AuditResultSchema = z.object({
  issues: z.array(NewPromptIssueSchema),
  auditedUrls: z.array(z.string()).optional(),
  total_issues: z.number().optional(),
  pages_with_issues: z.number().optional(),
  pages_audited: z.number().optional(),
})

// Full audit result type (includes metadata)
export type AuditResult = {
  issues: Array<{
    page_url: string
    category: 'Language' | 'Facts & Consistency' | 'Links & Formatting'
    issue_description: string
    severity: 'low' | 'medium' | 'critical'
    suggested_fix: string
  }>
  pagesAudited: number // Derived from openedPages.length or response
  auditedUrls?: string[]
  total_issues?: number
  pages_with_issues?: number
  responseId?: string
  status?: "completed" | "in_progress" | "queued" | "failed"
  tier?: AuditTier
  modelDurationMs?: number // Time taken for model to respond (in milliseconds)
  rawStatus?: string // Raw status from OpenAI API
}

// Legacy JSON schema removed - using new prompt format with Zod validation

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
// Mini Audit - Free tier (GPT-5.1 with web_search)
// ============================================================================
export async function miniAudit(
  domain: string, 
  existingResponseId?: string
): Promise<AuditResult> {
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
    
    let response: any
    let finalResponse: any
    
    if (existingResponseId) {
      // Use existing response (for SSE streaming scenario)
      Logger.debug(`[MiniAudit] Using existing responseId: ${existingResponseId}`)
      finalResponse = await openai.responses.retrieve(existingResponseId)
      response = { id: existingResponseId } // Store id for return value
    } else {
      // Create new response
      // Note: Model config params (effort, summary, store, text.format, verbosity) 
      // are configured in the prompt definition itself - don't override here
      Logger.debug(`[MiniAudit] Sending request to GPT-5.1 with web_search`)
      const params: any = {
        model: "gpt-5.1-2025-11-13",
        prompt: {
          id: MINI_AUDIT_PROMPT_ID,
          version: MINI_AUDIT_PROMPT_VERSION,
          variables: {
            url: normalizedDomain
          }
        },
        tools: [{
          type: "web_search",
          filters: {
            allowed_domains: [domainHostname]
          }
        }],
        max_tool_calls: tier.maxToolCalls, // Allow opening homepage + key pages
        max_output_tokens: 20000, // Increased for full JSON response
        include: ["web_search_call.action.sources"], // Include sources to get URLs
        // Model config params (matching prompt definition settings)
        text: {
          format: { type: "text" },
          verbosity: "low"
        },
        reasoning: {
          effort: "low",
          summary: null // Explicitly disable reasoning summaries (version 3 optimized for speed)
        },
        store: true
      }
      
      try {
        response = await openai.responses.create(params)
        finalResponse = response
      } catch (createError) {
        Logger.error(`[MiniAudit] Error creating response`, createError instanceof Error ? createError : undefined, {
          params: JSON.stringify(params, null, 2)
        })
        throw createError
      }
    }
    
    // Poll for completion if needed
    let status = finalResponse.status as string
    let attempts = 0
    const maxAttempts = 60 // 60 seconds max
    const currentResponseId = existingResponseId || response.id
    
    while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      finalResponse = await openai.responses.retrieve(currentResponseId)
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
    
    // Check for bot protection string response (not JSON)
    const trimmedOutput = outputText.trim()
    if (trimmedOutput === "BOT_PROTECTION_OR_FIREWALL_BLOCKED") {
      Logger.warn(`[MiniAudit] ⚠️ Bot protection detected by model`)
      throw new Error("Bot protection detected. Remove firewall/bot protection to crawl this site.")
    }
    
    // Try to parse JSON from output
    let parsed: any
    try {
      // Check for null response (no issues found)
      if (trimmedOutput === "null" || trimmedOutput === "null\n") {
        parsed = { issues: [], total_issues: 0, pages_with_issues: 0, pages_audited: openedPages.length || 0 }
      } else {
        const jsonMatch = outputText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          // Fallback: transform plain text to JSON
          Logger.debug(`[MiniAudit] Transforming output to structured JSON`)
          const structuredOutput = await transformToStructuredJSON(outputText, normalizedDomain)
          parsed = JSON.parse(structuredOutput)
        }
      }
    } catch (parseError) {
      // Transform plain text to JSON
      Logger.debug(`[MiniAudit] Transforming output to structured JSON`)
      const structuredOutput = await transformToStructuredJSON(outputText, normalizedDomain)
      parsed = JSON.parse(structuredOutput)
    }
    
    // Validate with Zod schema
    const validated = AuditResultSchema.parse(parsed)
    
    // Use opened pages for auditedUrls if available, otherwise extract from issues
    const auditedUrls = openedPages.length > 0 
      ? openedPages 
      : validated.issues.length > 0
        ? [...new Set(validated.issues.map((issue: any) => issue.page_url))]
        : []
    
    // Detect bot protection: if response completed quickly but no pages were opened
    // This indicates the site is blocking automated access
    const hasBotProtection = openedPages.length === 0 && auditedUrls.length === 0 && modelDurationMs < 5000
    if (hasBotProtection) {
      Logger.warn(`[MiniAudit] ⚠️ Bot protection detected: Completed in ${modelDurationMs}ms with 0 pages opened. Site may be blocking automated access.`)
      // Check output text for bot protection indicators, or if no issues found (likely blocked)
      const outputShowsBotProtection = outputText && detectBotProtection(outputText)
      const noIssuesFound = validated.issues.length === 0
      
      // If bot protection indicators found OR no pages opened and no issues, throw error
      if (outputShowsBotProtection || (noIssuesFound && modelDurationMs < 3000)) {
        throw new Error("Bot protection detected. Remove firewall/bot protection to crawl this site.")
      }
    }
    
    // Calculate pagesAudited from response or opened pages
    const pagesAudited = validated.pages_audited 
      ?? openedPages.length 
      ?? (auditedUrls.length > 0 ? auditedUrls.length : 1)
    
    Logger.info(`[MiniAudit] ✅ Complete: ${validated.issues.length} issues, ${pagesAudited} pages audited, ${auditedUrls.length} URLs`)
    
    return {
      issues: validated.issues,
      pagesAudited,
      auditedUrls,
      status: "completed",
      tier: "FREE",
      modelDurationMs,
      responseId: currentResponseId,
    }
  } catch (error) {
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error(`[MiniAudit] ❌ Full error:`, error.message)
      console.error(`[MiniAudit] Stack:`, error.stack)
    } else {
      console.error(`[MiniAudit] ❌ Unknown error:`, error)
    }
    Logger.error(`[MiniAudit] Error`, error instanceof Error ? error : undefined)
    throw handleAuditError(error)
  }
}

// ============================================================================
// Full Audit - Paid/Enterprise tier (GPT-5.1 with web_search, synchronous)
// ============================================================================
export async function auditSite(
  domain: string,
  tier: AuditTier = "PAID"
): Promise<AuditResult> {
  // Type guard: FREE tier should use miniAudit() instead
  if (tier === 'FREE') {
    Logger.warn(`[AuditSite] FREE tier should use miniAudit(), not auditSite(). Falling back to miniAudit().`)
    return miniAudit(domain)
  }
  
  const tierConfig = AUDIT_TIERS[tier]

  // Normalize domain URL
  const normalizedDomain = normalizeDomain(domain)
  const domainHostname = extractDomainHostname(normalizedDomain)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 300000, // 5min timeout
  })

  try {
    Logger.info(`[AuditSite] Starting GPT-5.1 web_search audit for ${normalizedDomain} (tier: ${tier})`)
    const modelStartTime = Date.now()
    
    Logger.debug(`[AuditSite] Sending request to GPT-5.1 with web_search (maxToolCalls: ${tierConfig.maxToolCalls})`)
    const params: any = {
      model: tierConfig.model,
      prompt: {
        id: AUDIT_PROMPT_ID,
        version: AUDIT_PROMPT_VERSION,
        variables: {
          url: normalizedDomain
        }
      },
      tools: [{
        type: "web_search",
        filters: {
          allowed_domains: [domainHostname]
        }
      }],
      max_tool_calls: tierConfig.maxToolCalls, // Limit tool calls based on tier
      max_output_tokens: 20000, // Increased for full JSON response
      include: ["web_search_call.action.sources"], // Include sources to get URLs
      // Model config params (matching prompt definition settings)
      text: {
        format: { type: "text" },
        verbosity: "low"
      },
      reasoning: {
        effort: "medium",
        summary: null // Explicitly disable reasoning summaries for full audit
      },
      store: true
    }
    
    let response: any
    try {
      response = await openai.responses.create(params)
    } catch (createError) {
      Logger.error(`[AuditSite] Error creating response`, createError instanceof Error ? createError : undefined, {
        params: JSON.stringify(params, null, 2)
      })
      throw createError
    }
    
    // Poll for completion if needed (synchronous polling)
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
        Logger.debug(`[AuditSite] Status: ${status} (${attempts}s)`)
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
    
    Logger.info(`[AuditSite] Tool calls used: ${toolCallsUsed}/${tierConfig.maxToolCalls} (${openedPages.length} pages opened)`)
    
    // Check for bot protection string response (not JSON)
    const trimmedOutput = outputText.trim()
    if (trimmedOutput === "BOT_PROTECTION_OR_FIREWALL_BLOCKED") {
      Logger.warn(`[AuditSite] ⚠️ Bot protection detected by model`)
      throw new Error("Bot protection detected. Remove firewall/bot protection to crawl this site.")
    }
    
    // Try to parse JSON from output
    let parsed: any
    try {
      // Check for null response (no issues found)
      if (trimmedOutput === "null" || trimmedOutput === "null\n") {
        parsed = { issues: [], total_issues: 0, pages_with_issues: 0, pages_audited: openedPages.length || 0 }
      } else {
        const jsonMatch = outputText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          // Fallback: transform plain text to JSON
          Logger.debug(`[AuditSite] Transforming output to structured JSON`)
          const structuredOutput = await transformToStructuredJSON(outputText, normalizedDomain)
          parsed = JSON.parse(structuredOutput)
        }
      }
    } catch (parseError) {
      // Transform plain text to JSON
      Logger.debug(`[AuditSite] Transforming output to structured JSON`)
      const structuredOutput = await transformToStructuredJSON(outputText, normalizedDomain)
      parsed = JSON.parse(structuredOutput)
    }
    
    // Validate with Zod schema
    const validated = AuditResultSchema.parse(parsed)
    
    // Use opened pages for auditedUrls if available, otherwise extract from issues
    const auditedUrls = openedPages.length > 0 
      ? openedPages 
      : validated.issues.length > 0
        ? [...new Set(validated.issues.map((issue: any) => issue.page_url))]
        : []
    
    // Detect bot protection: if response completed quickly but no pages were opened
    // This indicates the site is blocking automated access
    const hasBotProtection = openedPages.length === 0 && auditedUrls.length === 0 && modelDurationMs < 5000
    if (hasBotProtection) {
      Logger.warn(`[AuditSite] ⚠️ Bot protection detected: Completed in ${modelDurationMs}ms with 0 pages opened. Site may be blocking automated access.`)
      // Check output text for bot protection indicators, or if no issues found (likely blocked)
      const outputShowsBotProtection = outputText && detectBotProtection(outputText)
      const noIssuesFound = validated.issues.length === 0
      
      // If bot protection indicators found OR no pages opened and no issues, throw error
      if (outputShowsBotProtection || (noIssuesFound && modelDurationMs < 3000)) {
        throw new Error("Bot protection detected. Remove firewall/bot protection to crawl this site.")
      }
    }
    
    // Calculate pagesAudited from response or opened pages
    const pagesAudited = validated.pages_audited 
      ?? openedPages.length 
      ?? (auditedUrls.length > 0 ? auditedUrls.length : 1)
    
    Logger.info(`[AuditSite] ✅ Complete: ${validated.issues.length} issues, ${pagesAudited} pages audited, ${auditedUrls.length} URLs (tier: ${tier})`)
    
    return {
      issues: validated.issues,
      pagesAudited,
      auditedUrls,
      status: "completed",
      tier,
      modelDurationMs,
    }
  } catch (error) {
    Logger.error(`[AuditSite] Error`, error instanceof Error ? error : undefined)
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
    // Poll response status - supports queued/in_progress/completed states (legacy only)
    const response = await openai.responses.retrieve(responseId)

    // Check both "queued" and "in_progress" states (cast to string for SDK type compat)
    const status = response.status as string
    if (status === "queued" || status === "in_progress") {
      // Try to extract progress info from partial response if available
      let auditedUrls: string[] = []
      let issues: any[] = []
      
      if (response.output_text) {
        try {
          const partial = JSON.parse(response.output_text)
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
      
      // Calculate pagesAudited from auditedUrls (accurate count from opened pages)
      const pagesAudited = auditedUrls.length > 0 ? auditedUrls.length : 0
      
      return {
        issues,
        pagesAudited,
        auditedUrls,
        responseId,
        status: status === "queued" ? "queued" : "in_progress",
        rawStatus: status,
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
        response.output_text = JSON.stringify({ issues: [], auditedUrls: [] })
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
      
      console.log(`[Audit] ✅ Complete: ${result.issues.length} issues, ${result.pagesAudited} pages audited, ${actualCrawledUrls.length} URLs`)
      return result
    }

    // Failed or cancelled
    console.error(`[Audit] Job failed or cancelled (${status}): ${responseId}`)
    console.error(`[Audit] Full response:`, JSON.stringify(response, null, 2))
    
    // Check if failure is due to model issues
    const error = response.error as any
    if (error?.code === 'model_not_found' || error?.message?.includes('verified')) {
      console.error(`[Audit] Model error during execution. Error: ${error?.message}`)
      throw new Error("The audit failed due to a model issue. Please try again in a few minutes.")
    }
    
    throw new Error(`Audit job failed with status: ${status}. ${error?.message || 'Please try again.'}`)
  } catch (error) {
    // Error will be logged by handleAuditError, so we don't duplicate here
    throw handleAuditError(error)
  }
}

// ============================================================================
// Transform plain text audit output to structured JSON using GPT-4o
// ============================================================================
async function transformToStructuredJSON(plainText: string, domain: string): Promise<string> {
  if (!plainText || plainText.trim().length === 0) {
    return JSON.stringify({ issues: [], auditedUrls: [] })
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
      "page_url": "<actual URL from text>",
      "category": "Language|Facts & Consistency|Links & Formatting",
      "issue_description": "impact_word: concise problem description",
      "severity": "low|medium|critical",
      "suggested_fix": "Direct, actionable fix"
    }
  ],
  "total_issues": <number>,
  "pages_with_issues": <number>,
  "pages_audited": <number>
}

CRITICAL RULES:
- Extract real URLs from the text - never use placeholders like "example.com"
- Format issue_description as "impact_word: description" (e.g., "professionalism: typo found")
- If no issues found, return null (JSON null value)
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

// Validation helper removed - Zod schema handles validation

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
  // GPT-5.1 responses have structure: output[] -> message -> content[] -> output_text
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
    throw new Error("Bot protection detected. Remove firewall/bot protection to crawl this site.")
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

  // Extract actual crawled URLs from response output (more accurate than text parsing)
  const actualCrawledUrls = extractCrawledUrls(response)
  const auditedUrls = actualCrawledUrls.length > 0 ? actualCrawledUrls : (Array.isArray(validated.auditedUrls) ? validated.auditedUrls : [])
  
  // Calculate pagesAudited from actual crawled URLs (accurate count)
  const pagesAudited = actualCrawledUrls.length > 0 ? actualCrawledUrls.length : (auditedUrls.length > 0 ? auditedUrls.length : 0)

  return {
    issues: validated.issues,
    pagesAudited,
    auditedUrls,
    responseId: response.id,
    status: "completed",
    tier,
  }
}

// Extract OpenAI request ID from error message for logging
function extractRequestId(errorMessage: string): string | null {
  const match = errorMessage.match(/req_[a-z0-9]+/i)
  return match ? match[0] : null
}

// Map OpenAI errors to user-friendly messages
function handleAuditError(error: unknown): Error {
  if (!(error instanceof Error)) {
    Logger.error("[Audit] Unknown error type", undefined, { error: String(error) })
    return new Error("Audit generation failed. Please try again.")
  }

  const msg = error.message.toLowerCase()
  
  // Detect OpenAI 500 errors with request IDs and help.openai.com references
  const isOpenAI500Error = (msg.includes("500") || msg.includes("error occurred while processing")) &&
                           (msg.includes("help.openai.com") || msg.includes("request id req_") || /req_[a-z0-9]+/i.test(error.message))
  
  if (isOpenAI500Error) {
    // Extract request ID for logging
    const requestId = extractRequestId(error.message)
    Logger.error("[Audit] OpenAI 500 error", error, { 
      requestId,
      // Only include stack in development
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    })
    return new Error("Our AI service encountered a temporary issue. Please try again in a moment.")
  }
  
  // Log original error for debugging - simplified for expected errors
  const isExpectedError = msg.includes('bot protection') || 
                         msg.includes('daily limit') ||
                         msg.includes('invalid domain') ||
                         msg.includes('rate_limit') ||
                         msg.includes('429')
  
  if (isExpectedError) {
    // For expected errors, log only message without full stack
    Logger.error(`[Audit] ${error.message}`)
  } else {
    // For unexpected errors, log with context but truncate stack in production
    Logger.error(`[Audit] Error: ${error.message}`, error, { 
      name: error.name,
      // Only include full stack in development
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    })
  }

  // Bot protection detection (check first before other errors)
  if (detectBotProtection(msg)) {
    return new Error("Bot protection detected. Remove firewall/bot protection to crawl this site.")
  }

  // Rate limits
  if (msg.includes("rate_limit") || msg.includes("429")) {
    return new Error("AI service is temporarily overloaded. Please wait a moment and try again.")
  }

  // Auth errors
  if (msg.includes("401") || msg.includes("invalid_api_key") || msg.includes("authentication")) {
    Logger.error("[Audit] API key error - check OPENAI_API_KEY")
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

  // Fallback - sanitize any remaining OpenAI errors
  if (error.message && error.message.length > 0) {
    // Check if it contains OpenAI-specific patterns that should be sanitized
    if (msg.includes("help.openai.com") || /req_[a-z0-9]+/i.test(error.message)) {
      const requestId = extractRequestId(error.message)
      Logger.error("[Audit] Unhandled OpenAI error", error, { 
        requestId,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
      })
      return new Error("Our AI service encountered an issue. Please try again in a moment.")
    }
    
    // For other errors, return generic message
    return new Error("Audit generation failed. Please try again.")
  }
  
  return new Error("Audit generation failed. Please try again.")
}