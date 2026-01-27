/**
 * Multi-Model Parallel Audit Test Script
 *
 * Compares single-model audit vs 3 parallel specialized models:
 * - Model A: Language issues (typos, grammar, spelling)
 * - Model B: Facts & Consistency issues (errors, inconsistencies)
 * - Model C: Links & Formatting issues (broken links, formatting)
 *
 * Tracks: run time, tokens, cost, issues found
 *
 * Usage: pnpm tsx scripts/test-parallel-audit.ts <domain>
 * Example: pnpm tsx scripts/test-parallel-audit.ts stripe.com
 */

import OpenAI from "openai"
import { extractElementManifest, formatManifestForPrompt, countInternalPages, extractDiscoveredPagesList } from "../lib/manifest-extractor"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// Same model config as production mini audit
const MODEL = "gpt-5.1-2025-11-13"
const MAX_TOOL_CALLS = 10 // Same as FREE tier
const MAX_OUTPUT_TOKENS = 20000
const MAX_POLL_SECONDS = 240 // 4 minutes

// Pricing per 1M tokens (GPT-5.1 pricing)
const INPUT_COST_PER_1M = 2.50  // $2.50 per 1M input tokens
const OUTPUT_COST_PER_1M = 10.00 // $10.00 per 1M output tokens

interface AuditIssue {
  page_url: string
  category: "Language" | "Facts & Consistency" | "Links & Formatting"
  issue_description: string
  severity: "low" | "medium" | "critical"
  suggested_fix: string
}

interface AuditResult {
  issues: AuditIssue[]
  total_issues: number
  pages_audited: number
  durationMs: number
  inputTokens: number
  outputTokens: number
  cost: number
  toolCallsUsed: number
}

interface ComparisonResult {
  domain: string
  timestamp: string
  singleModel: AuditResult | null
  parallelModels: {
    language: AuditResult | null
    factsConsistency: AuditResult | null
    linksFormatting: AuditResult | null
    combined: AuditResult | null
    totalDurationMs: number
  } | null
  comparison: {
    speedup: number // e.g., 2.5 = 2.5x faster
    costDifference: number // negative = savings
    issueCountDifference: number
    singleModelIssues: number
    parallelIssues: number
  } | null
}

// Normalize domain URL
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

// Extract domain hostname for filtering
function extractDomainHostname(domain: string): string {
  try {
    const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    return url.hostname
  } catch {
    return domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

// Calculate cost from tokens
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_1M
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M
  return inputCost + outputCost
}

// Build category-specific prompt
function buildCategoryPrompt(
  category: "Language" | "Facts & Consistency" | "Links & Formatting",
  url: string,
  manifestText: string
): string {
  const categoryInstructions = {
    "Language": `Focus ONLY on Language issues:
- Typos and misspellings
- Grammar errors
- Punctuation mistakes
- Spelling inconsistencies
- Awkward phrasing

DO NOT report Facts/Consistency or Links/Formatting issues.`,

    "Facts & Consistency": `Focus ONLY on Facts & Consistency issues:
- Factual errors or incorrect information
- Inconsistent data, numbers, or stats across pages
- Contradictory statements
- Outdated information
- Naming inconsistencies (product names, company name variations)

DO NOT report Language or Links/Formatting issues.`,

    "Links & Formatting": `Focus ONLY on Links & Formatting issues:
- Broken links (404s, 500s)
- Links pointing to wrong destinations
- Confusing or unclear link text
- Formatting problems
- Layout issues affecting readability

DO NOT report Language or Facts/Consistency issues.`
  }

  return `You are auditing ${url} for ${category} issues ONLY.

${manifestText ? `Below is an ELEMENT MANIFEST showing interactive elements on the page:\n${manifestText}\n\n---\n` : ''}

${categoryInstructions[category]}

Audit only the homepage and one additional key public-facing page.

**HOW TO USE THE MANIFEST:**
- Use it to avoid false positives about missing elements
- Still test all links by clicking them
- The manifest shows code structure, NOT functionality

If you encounter bot protection, return: BOT_PROTECTION_OR_FIREWALL_BLOCKED

For every issue, provide:
- page_url: The URL where issue was found
- category: "${category}" (always this category)
- issue_description: Start with impact word (professionalism:, frustration:, trust:, credibility:) then concise problem
- severity: "critical", "medium", or "low"
- suggested_fix: Direct, actionable fix

Output format:
{
  "issues": [...],
  "total_issues": <number>,
  "pages_with_issues": <number>,
  "pages_audited": <number>
}

If no ${category} issues found, return: null`
}

// Run single model audit (current approach)
async function runSingleModelAudit(
  domain: string,
  manifestText: string,
  openai: OpenAI
): Promise<AuditResult> {
  const normalizedDomain = normalizeDomain(domain)
  const domainHostname = extractDomainHostname(normalizedDomain)

  console.log(`\n[Single Model] Starting audit for ${normalizedDomain}`)
  const startTime = Date.now()

  // Use the same prompt as buildMiniAuditPrompt
  const promptText = `You are auditing ${normalizedDomain}. Below is an ELEMENT MANIFEST extracted from the actual HTML source code, showing all interactive elements (links, buttons, forms, headings) that exist on the page.

${manifestText}

---

Audit only the homepage and one additional key public-facing page of a website for language quality, factual accuracy, and functional links/formatting. In a single unified pass, audit both pages for all three content categories at once: Language, Facts & Consistency, and Links & Formatting. For each page, identify and log issues per category:

- Language (typos, grammar, spelling, punctuation)
- Facts & Consistency (factual errors, inconsistencies, incorrect stats)
- Links & Formatting (broken links, wrong destinations, confusing link text, formatting or layout problems)

**HOW TO USE THE MANIFEST:**
Use the manifest ONLY to avoid false positives about missing links/elements. The manifest shows code structure, NOT functionality.

**AUDIT THOROUGHLY:**
- Test ALL links by clicking them
- Open multiple pages to find issues across the site
- Use your full tool call allowance to be comprehensive

If you encounter bot protection or a firewall blocking access, return: BOT_PROTECTION_OR_FIREWALL_BLOCKED

For every issue found, provide an ultra-concise description. Format the issue description as follows:
- Start with a category-level impact (e.g., "professionalism:", "frustration:", "trust:") in lowercase
- Then briefly state the problem

Output format:
{
  "issues": [
    {
      "page_url": "[string]",
      "category": "Language|Facts & Consistency|Links & Formatting",
      "issue_description": "[impact]: [problem]",
      "severity": "critical|medium|low",
      "suggested_fix": "[fix]"
    }
  ],
  "total_issues": [integer],
  "pages_with_issues": [integer],
  "pages_audited": [integer]
}

If no issues are found, return: null`

  const params = {
    model: MODEL,
    input: promptText,
    tools: [{
      type: "web_search" as const,
      filters: {
        allowed_domains: [domainHostname]
      }
    }],
    max_tool_calls: MAX_TOOL_CALLS,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    include: ["web_search_call.action.sources"] as const,
    text: {
      format: { type: "text" as const },
      verbosity: "low" as const
    },
    reasoning: {
      effort: "medium" as const,
      summary: null
    },
    store: true
  }

  console.log(`[Single Model] Calling OpenAI API...`)
  const response = await openai.responses.create(params as any)
  console.log(`[Single Model] Response created: ${response.id}, status: ${response.status}`)

  // Poll for completion
  let finalResponse = response
  let status = response.status as string
  let attempts = 0
  const maxAttempts = MAX_POLL_SECONDS

  while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    finalResponse = await openai.responses.retrieve(response.id)
    status = finalResponse.status as string
    attempts++
    if (attempts % 15 === 0) {
      console.log(`  [Single Model] Polling: ${status} (${attempts}s / ${maxAttempts}s max)`)
    }
  }

  const durationMs = Date.now() - startTime
  console.log(`[Single Model] Completed in ${(durationMs / 1000).toFixed(1)}s`)

  // Extract token usage
  const usage = (finalResponse as any).usage || {}
  const inputTokens = usage.input_tokens || 0
  const outputTokens = usage.output_tokens || 0

  // Extract tool calls used
  let toolCallsUsed = 0
  if (Array.isArray(finalResponse.output)) {
    toolCallsUsed = finalResponse.output.filter((item: any) => item.type === 'web_search_call').length
  }

  // Parse output
  let issues: AuditIssue[] = []
  let pagesAudited = 0
  const outputText = finalResponse.output_text || ''

  if (outputText && outputText.trim() !== 'null' && outputText.trim() !== 'BOT_PROTECTION_OR_FIREWALL_BLOCKED') {
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        issues = parsed.issues || []
        pagesAudited = parsed.pages_audited || 0
      }
    } catch (e) {
      console.log(`  [Single Model] Failed to parse JSON: ${e}`)
    }
  }

  return {
    issues,
    total_issues: issues.length,
    pages_audited: pagesAudited,
    durationMs,
    inputTokens,
    outputTokens,
    cost: calculateCost(inputTokens, outputTokens),
    toolCallsUsed
  }
}

// Run category-specific audit
async function runCategoryAudit(
  category: "Language" | "Facts & Consistency" | "Links & Formatting",
  domain: string,
  manifestText: string,
  openai: OpenAI
): Promise<AuditResult> {
  const normalizedDomain = normalizeDomain(domain)
  const domainHostname = extractDomainHostname(normalizedDomain)

  console.log(`\n[${category}] Starting audit for ${normalizedDomain}`)
  const startTime = Date.now()

  const promptText = buildCategoryPrompt(category, normalizedDomain, manifestText)

  // Each category gets fewer tool calls since scope is narrower
  // Total: 10 tool calls split across 3 = ~3-4 each
  const categoryToolCalls = Math.ceil(MAX_TOOL_CALLS / 3)

  const params = {
    model: MODEL,
    input: promptText,
    tools: [{
      type: "web_search" as const,
      filters: {
        allowed_domains: [domainHostname]
      }
    }],
    max_tool_calls: categoryToolCalls,
    max_output_tokens: MAX_OUTPUT_TOKENS, // Full tokens - web_search generates lots of intermediate output
    include: ["web_search_call.action.sources"] as const,
    text: {
      format: { type: "text" as const },
      verbosity: "low" as const
    },
    reasoning: {
      effort: "low" as const,
      summary: null
    },
    store: true
  }

  console.log(`[${category}] Calling OpenAI API...`)
  const response = await openai.responses.create(params as any)
  console.log(`[${category}] Response created: ${response.id}, status: ${response.status}`)

  // Poll for completion
  let finalResponse = response
  let status = response.status as string
  let attempts = 0
  const maxAttempts = MAX_POLL_SECONDS

  while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    finalResponse = await openai.responses.retrieve(response.id)
    status = finalResponse.status as string
    attempts++
    if (attempts % 15 === 0) {
      console.log(`  [${category}] Polling: ${status} (${attempts}s / ${maxAttempts}s max)`)
    }
  }

  const durationMs = Date.now() - startTime
  console.log(`[${category}] Completed with status: ${status} in ${(durationMs / 1000).toFixed(1)}s`)

  // Extract token usage
  const usage = (finalResponse as any).usage || {}
  const inputTokens = usage.input_tokens || 0
  const outputTokens = usage.output_tokens || 0

  // Extract tool calls used
  let toolCallsUsed = 0
  if (Array.isArray(finalResponse.output)) {
    toolCallsUsed = finalResponse.output.filter((item: any) => item.type === 'web_search_call').length
  }

  // Parse output
  let issues: AuditIssue[] = []
  let pagesAudited = 0
  const outputText = finalResponse.output_text || ''

  if (outputText && outputText.trim() !== 'null' && outputText.trim() !== 'BOT_PROTECTION_OR_FIREWALL_BLOCKED') {
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        issues = (parsed.issues || []).map((issue: any) => ({
          ...issue,
          category // Ensure category is set correctly
        }))
        pagesAudited = parsed.pages_audited || 0
      }
    } catch (e) {
      console.log(`  [${category}] Failed to parse JSON: ${e}`)
    }
  }

  return {
    issues,
    total_issues: issues.length,
    pages_audited: pagesAudited,
    durationMs,
    inputTokens,
    outputTokens,
    cost: calculateCost(inputTokens, outputTokens),
    toolCallsUsed
  }
}

// Run all three category audits in parallel
async function runParallelAudit(
  domain: string,
  manifestText: string,
  openai: OpenAI
): Promise<{
  language: AuditResult
  factsConsistency: AuditResult
  linksFormatting: AuditResult
  combined: AuditResult
  totalDurationMs: number
}> {
  console.log('\n=== PARALLEL AUDIT (3 models) ===')
  const startTime = Date.now()

  // Run all three in parallel
  const [language, factsConsistency, linksFormatting] = await Promise.all([
    runCategoryAudit("Language", domain, manifestText, openai),
    runCategoryAudit("Facts & Consistency", domain, manifestText, openai),
    runCategoryAudit("Links & Formatting", domain, manifestText, openai)
  ])

  const totalDurationMs = Date.now() - startTime

  // Combine results
  const allIssues = [
    ...language.issues,
    ...factsConsistency.issues,
    ...linksFormatting.issues
  ]

  const combined: AuditResult = {
    issues: allIssues,
    total_issues: allIssues.length,
    pages_audited: Math.max(language.pages_audited, factsConsistency.pages_audited, linksFormatting.pages_audited),
    durationMs: totalDurationMs,
    inputTokens: language.inputTokens + factsConsistency.inputTokens + linksFormatting.inputTokens,
    outputTokens: language.outputTokens + factsConsistency.outputTokens + linksFormatting.outputTokens,
    cost: language.cost + factsConsistency.cost + linksFormatting.cost,
    toolCallsUsed: language.toolCallsUsed + factsConsistency.toolCallsUsed + linksFormatting.toolCallsUsed
  }

  return {
    language,
    factsConsistency,
    linksFormatting,
    combined,
    totalDurationMs
  }
}

// Main comparison function
async function runComparison(domain: string): Promise<ComparisonResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 300000, // 5min timeout
  })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`MULTI-MODEL AUDIT COMPARISON TEST`)
  console.log(`Domain: ${domain}`)
  console.log(`${'='.repeat(60)}`)

  // Extract manifest once (used by both approaches)
  console.log('\n[Setup] Extracting element manifest...')
  const normalizedDomain = normalizeDomain(domain)
  const manifests = await extractElementManifest(normalizedDomain)
  const manifestText = formatManifestForPrompt(manifests)
  const pagesFound = countInternalPages(manifests)
  console.log(`[Setup] Manifest ready: ${manifests.length} pages extracted, ${pagesFound} unique pages found`)

  const result: ComparisonResult = {
    domain,
    timestamp: new Date().toISOString(),
    singleModel: null,
    parallelModels: null,
    comparison: null
  }

  // Skip single model for this test
  console.log('\n=== SKIPPING SINGLE MODEL (testing parallel only) ===')

  // Run parallel audit
  try {
    result.parallelModels = await runParallelAudit(domain, manifestText, openai)
  } catch (error) {
    console.error(`[Parallel] Failed: ${error}`)
  }

  // Calculate comparison metrics
  if (result.singleModel && result.parallelModels) {
    const single = result.singleModel
    const parallel = result.parallelModels.combined

    result.comparison = {
      speedup: single.durationMs / parallel.durationMs,
      costDifference: parallel.cost - single.cost,
      issueCountDifference: parallel.total_issues - single.total_issues,
      singleModelIssues: single.total_issues,
      parallelIssues: parallel.total_issues
    }
  }

  return result
}

// Print results
function printResults(result: ComparisonResult) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`RESULTS SUMMARY`)
  console.log(`${'='.repeat(60)}`)

  if (result.singleModel) {
    const s = result.singleModel
    console.log(`\n[Single Model]`)
    console.log(`  Duration: ${(s.durationMs / 1000).toFixed(1)}s`)
    console.log(`  Issues found: ${s.total_issues}`)
    console.log(`  Pages audited: ${s.pages_audited}`)
    console.log(`  Tool calls: ${s.toolCallsUsed}/${MAX_TOOL_CALLS}`)
    console.log(`  Tokens: ${s.inputTokens.toLocaleString()} in / ${s.outputTokens.toLocaleString()} out`)
    console.log(`  Cost: $${s.cost.toFixed(4)}`)

    if (s.issues.length > 0) {
      console.log(`  Issues by category:`)
      const byCategory = s.issues.reduce((acc, issue) => {
        acc[issue.category] = (acc[issue.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      Object.entries(byCategory).forEach(([cat, count]) => {
        console.log(`    - ${cat}: ${count}`)
      })
    }
  }

  if (result.parallelModels) {
    const p = result.parallelModels
    console.log(`\n[Parallel Models]`)
    console.log(`  Total duration: ${(p.totalDurationMs / 1000).toFixed(1)}s (wall clock)`)

    console.log(`\n  Language model:`)
    console.log(`    Duration: ${(p.language.durationMs / 1000).toFixed(1)}s`)
    console.log(`    Issues: ${p.language.total_issues}`)
    console.log(`    Cost: $${p.language.cost.toFixed(4)}`)

    console.log(`\n  Facts & Consistency model:`)
    console.log(`    Duration: ${(p.factsConsistency.durationMs / 1000).toFixed(1)}s`)
    console.log(`    Issues: ${p.factsConsistency.total_issues}`)
    console.log(`    Cost: $${p.factsConsistency.cost.toFixed(4)}`)

    console.log(`\n  Links & Formatting model:`)
    console.log(`    Duration: ${(p.linksFormatting.durationMs / 1000).toFixed(1)}s`)
    console.log(`    Issues: ${p.linksFormatting.total_issues}`)
    console.log(`    Cost: $${p.linksFormatting.cost.toFixed(4)}`)

    console.log(`\n  Combined:`)
    console.log(`    Total issues: ${p.combined.total_issues}`)
    console.log(`    Total cost: $${p.combined.cost.toFixed(4)}`)
    console.log(`    Total tokens: ${p.combined.inputTokens.toLocaleString()} in / ${p.combined.outputTokens.toLocaleString()} out`)
    console.log(`    Total tool calls: ${p.combined.toolCallsUsed}`)
  }

  if (result.comparison) {
    const c = result.comparison
    console.log(`\n${'='.repeat(60)}`)
    console.log(`COMPARISON`)
    console.log(`${'='.repeat(60)}`)
    console.log(`  Speed: ${c.speedup.toFixed(2)}x ${c.speedup > 1 ? 'faster' : 'slower'} (parallel)`)
    console.log(`  Cost: ${c.costDifference > 0 ? '+' : ''}$${c.costDifference.toFixed(4)} (parallel ${c.costDifference > 0 ? 'more expensive' : 'cheaper'})`)
    console.log(`  Issues: ${c.parallelIssues} (parallel) vs ${c.singleModelIssues} (single)`)
    console.log(`  Issue difference: ${c.issueCountDifference > 0 ? '+' : ''}${c.issueCountDifference}`)
  }

  // Print all issues for comparison
  console.log(`\n${'='.repeat(60)}`)
  console.log(`ISSUES FOUND`)
  console.log(`${'='.repeat(60)}`)

  if (result.singleModel && result.singleModel.issues.length > 0) {
    console.log(`\n[Single Model Issues]`)
    result.singleModel.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.category}] ${issue.severity.toUpperCase()}`)
      console.log(`     ${issue.issue_description}`)
      console.log(`     URL: ${issue.page_url}`)
    })
  }

  if (result.parallelModels && result.parallelModels.combined.issues.length > 0) {
    console.log(`\n[Parallel Model Issues]`)
    result.parallelModels.combined.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.category}] ${issue.severity.toUpperCase()}`)
      console.log(`     ${issue.issue_description}`)
      console.log(`     URL: ${issue.page_url}`)
    })
  }
}

// Main
async function main() {
  const domain = process.argv[2]

  if (!domain) {
    console.log('Usage: pnpm tsx scripts/test-parallel-audit.ts <domain>')
    console.log('Example: pnpm tsx scripts/test-parallel-audit.ts stripe.com')
    process.exit(1)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not set in .env.local')
    process.exit(1)
  }

  try {
    const result = await runComparison(domain)
    printResults(result)

    // Save results to file
    const filename = `parallel-audit-results-${domain.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`
    const fs = await import('fs')
    fs.writeFileSync(filename, JSON.stringify(result, null, 2))
    console.log(`\nResults saved to: ${filename}`)

  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

main()
