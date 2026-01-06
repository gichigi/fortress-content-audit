#!/usr/bin/env tsx
/**
 * Test script: O3 Deep Research + GPT-4.1 Transformer
 * 
 * Category-Specific Approach:
 * 1. Pass 1: Factual consistency (compare pricing/features across pages)
 * 2. Pass 2: Grammar/spelling (systematic text review)
 * 3. Pass 3: Broken links (follow every href)
 * 4. Combine results from all passes
 * 
 * Uses web_search tool (newer) instead of web_search_preview (deprecated).
 * Domain filtering ensures O3 stays within target domain.
 * 
 * Usage: pnpm tsx scripts/test-paid-audit-pages.ts [domain]
 */

import dotenv from "dotenv"
import OpenAI from "openai"

// Load .env.local first (Next.js convention), then .env as fallback
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

// ============================================================================
// Config
// ============================================================================

// Test sites - real sites with multiple pages
const TEST_SITES = [
  "stripe.com",           // Large site, many pages
  "vercel.com",           // Medium site
  "linear.app",           // SaaS with multiple pages
  "supabase.com",         // Docs-heavy site
]

// O3 Deep Research config
const O3_CONFIG = {
  maxToolCalls: 30, // Reduced per pass since we're running 3 passes
  model: "o3-deep-research" as const,
  maxOutputTokens: 80000,
}

// Transformer model
const TRANSFORMER_MODEL = "gpt-4.1" as const

// ============================================================================
// Helper: Transform o3 output to structured JSON using GPT-4.1
// ============================================================================
async function transformO3OutputToJSON(plainText: string, domain: string, openai: OpenAI): Promise<any> {
  if (!plainText || plainText.trim().length === 0) {
    return { issues: [], auditedUrls: [] }
  }
  
  const systemPrompt = `You are a JSON transformer. Convert audit findings from plain text to structured JSON.

RULES:
- Extract ONLY real URLs and data from the text
- Never use placeholder or example values
- If no URLs found, use empty arrays
- Extract actual snippets showing the error
- Return ONLY valid JSON, no markdown`
  
  const userPrompt = `Convert this audit report to JSON. Extract all real URLs and data:
  
${plainText}

Return this exact structure:
{
  "issues": [
    {
      "title": "Issue title",
      "category": "typos|grammar|punctuation|seo|factual|links|terminology|bot_protection",
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
  "auditedUrls": ["<actual URLs from text>"]
}

Base domain: ${domain}
Return ONLY valid JSON.`

  console.log(`\n[Transformer] Converting O3 output with ${TRANSFORMER_MODEL}...`)
  
  try {
    const response = await openai.chat.completions.create({
      model: TRANSFORMER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 16000,
    })

    const transformed = response.choices[0]?.message?.content
    if (!transformed) {
      throw new Error("Transformation returned empty response")
    }

    // Parse and validate
    try {
      const parsed = JSON.parse(transformed)
      console.log(`[Transformer] ✅ Extracted ${parsed.issues?.length || 0} issues`)
      return parsed
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = transformed.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        console.log(`[Transformer] ✅ Extracted ${parsed.issues?.length || 0} issues (from code block)`)
        return parsed
      }
      throw parseError
    }
  } catch (error) {
    console.error(`[Transformer] ❌ Error:`, error instanceof Error ? error.message : error)
    return { issues: [], auditedUrls: [] }
  }
}

// ============================================================================
// Audit Pass Types
// ============================================================================

type AuditPass = {
  name: string
  category: string
  prompt: (domain: string) => string
}

const AUDIT_PASSES: AuditPass[] = [
  {
    name: "Factual Consistency",
    category: "factual",
    prompt: (domain: string) => `Conduct a FACTUAL CONSISTENCY audit of ${domain}.

YOUR TASK: Find contradictions, outdated information, and conflicting data across pages.

CRITICAL: You must visit MULTIPLE pages (at least 10-15) to compare information.

WHAT TO CHECK:
1. Pricing information - same prices mentioned everywhere?
2. Product features - consistent feature lists?
3. Company information - founding date, employee count, locations
4. Statistics/metrics - same numbers across all pages?
5. Dates - publication dates, launch dates, "last updated"
6. Contact information - same email/phone everywhere?

STRATEGY:
1. Start at homepage - note all key facts
2. Visit pricing page - record all prices
3. Visit product pages - list all features
4. Visit about page - note company info
5. Visit multiple other pages and compare
6. Build a "truth table" of what's mentioned where
7. Flag ANY conflicts or inconsistencies

For each issue found:
- Title: Brief description of the contradiction
- Category: 'factual' or 'terminology'
- Severity: 'high' (major contradiction) or 'medium' (minor inconsistency)
- Impact: Why this matters to users
- Locations: List ALL URLs where conflicting info appears
- Snippet: The actual conflicting text from each page
- Fix: What the correct information should be

Return detailed findings listing ALL contradictions found.`
  },
  {
    name: "Grammar & Spelling",
    category: "grammar",
    prompt: (domain: string) => `Conduct a GRAMMAR & SPELLING audit of ${domain}.

YOUR TASK: Find typos, grammatical errors, and punctuation mistakes in visible text.

CRITICAL: You must systematically review ALL visible text on each page (headings, body, buttons, navigation, footer).

WHAT TO CHECK:
1. Spelling mistakes - wrong words, typos
2. Grammar errors - subject-verb agreement, tense inconsistencies
3. Punctuation - missing commas, periods, apostrophes
4. Capitalization - inconsistent use of title case
5. Repeated words - "the the", "and and", etc.

STRATEGY:
1. Visit homepage - read every word carefully
2. Visit key pages: pricing, features, about, contact
3. Visit documentation/blog pages (often have more text)
4. Check navigation menus and footers
5. Read ALL visible text on each page, don't skip anything
6. Be thorough - even small typos matter

For each issue found:
- Title: Brief description (e.g., "Typo: 'recieve' should be 'receive'")
- Category: 'typos', 'grammar', or 'punctuation'
- Severity: 'low' (minor typo), 'medium' (noticeable error), 'high' (changes meaning)
- Impact: Brief explanation of why it matters
- URL: Where the error appears
- Snippet: The exact text showing the error with context
- Fix: The corrected text

Return detailed findings listing ALL errors found.`
  },
  {
    name: "Broken Links",
    category: "links",
    prompt: (domain: string) => `Conduct a BROKEN LINKS audit of ${domain}.

YOUR TASK: Find all broken links, 404s, and links that lead to wrong destinations.

CRITICAL: You must systematically follow links from multiple pages (at least 15 pages).

WHAT TO CHECK:
1. Internal links - do they resolve correctly?
2. External links - do they still work?
3. 404 errors - pages that don't exist
4. Redirect loops - links that redirect endlessly
5. Wrong destinations - links that go to unexpected pages
6. Anchor links - hash links to sections that don't exist
7. Image links - broken image sources

STRATEGY:
1. Start at homepage - click all visible links
2. Visit navigation menus - test all menu items
3. Visit footer - test footer links
4. On each page, test ALL links (not just some)
5. Follow links to other pages, then test links on those pages
6. Keep track of which links you've already tested
7. Test both internal and external links

For each issue found:
- Title: Brief description (e.g., "404 error on /pricing-old page")
- Category: 'links'
- Severity: 'high' (critical page broken), 'medium' (minor page), 'low' (external link)
- Impact: Why this matters (e.g., "Users cannot access pricing information")
- URL: The page where the broken link appears
- Snippet: The link text/HTML showing the broken link
- Fix: What the correct URL should be (if known) or "Remove/update link"

Return detailed findings listing ALL broken links found.`
  }
]

// ============================================================================
// Single Audit Pass Execution
// ============================================================================

interface PassResult {
  passName: string
  issues: any[]
  openedUrls: string[]
  toolCallsUsed: number
  totalTokens?: number
  durationMs: number
  error?: string
}

async function runSingleAuditPass(
  domain: string,
  pass: AuditPass,
  openai: OpenAI
): Promise<PassResult> {
  const normalizedDomain = domain.startsWith("http") ? domain : `https://${domain}`
  const domainHostname = new URL(normalizedDomain).hostname
  const startTime = Date.now()
  
  console.log(`\n${"=".repeat(60)}`)
  console.log(`PASS: ${pass.name}`)
  console.log(`Category Focus: ${pass.category}`)
  console.log(`${"=".repeat(60)}`)
  
  const input = pass.prompt(normalizedDomain)
  
  console.log(`\n--- PROMPT PREVIEW ---`)
  console.log(input.substring(0, 300) + "...")
  
  try {
    const params: any = {
      model: O3_CONFIG.model,
      input: input,
      tools: [{
        type: "web_search",  // Using newer web_search instead of web_search_preview
        filters: {
          allowed_domains: [domainHostname]
        }
      }],
      max_tool_calls: O3_CONFIG.maxToolCalls,
      max_output_tokens: O3_CONFIG.maxOutputTokens,
      include: ["web_search_call.action.sources"], // Include sources for URL discovery
      text: { verbosity: "medium" },
      background: true,
    }
    
    console.log(`\nSending request to ${O3_CONFIG.model}...`)
    
    const response = await openai.responses.create(params)
    
    // Poll for completion
    let status = response.status as string
    let finalResponse = response
    let attempts = 0
    const maxAttempts = 600 // 10 min max
    
    while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      finalResponse = await openai.responses.retrieve(response.id)
      status = finalResponse.status as string
      attempts++
      if (attempts % 30 === 0) {
        console.log(`  [${pass.name}] Status: ${status} (${attempts}s elapsed)`)
      }
    }
    
    const durationMs = Date.now() - startTime
    
    if (status !== "completed" && status !== "incomplete") {
      throw new Error(`Audit failed with status: ${status}`)
    }
    
    // Extract opened pages
    const openedPages: string[] = []
    let toolCallsUsed = 0
    
    if (finalResponse.output && Array.isArray(finalResponse.output)) {
      // Using web_search now, but keep legacy check for safety
      const webSearchCalls = finalResponse.output.filter((item: any) => 
        item.type === 'web_search_call' || item.type === 'web_search_preview_call'
      )
      toolCallsUsed = webSearchCalls.length
      
      webSearchCalls.forEach((call: any) => {
        // Track pages actually opened (not just searched/previewed)
        if (call.action?.type === 'open_page' && call.action.url) {
          openedPages.push(call.action.url)
        }
      })
      
      // Log search vs open actions for debugging
      const searchActions = webSearchCalls.filter((call: any) => call.action?.type === 'search').length
      const openActions = webSearchCalls.filter((call: any) => call.action?.type === 'open_page').length
      if (searchActions > 0 || openActions > 0) {
        console.log(`  📊 Tool actions: ${openActions} pages opened, ${searchActions} searches`)
      }
    }
    
    console.log(`  ✅ ${pass.name}: ${openedPages.length} pages opened, ${toolCallsUsed} tool calls`)
    
    // Extract output text
    let outputText = finalResponse.output_text || ''
    if (!outputText && Array.isArray(finalResponse.output)) {
      const messageItems = finalResponse.output.filter((item: any) => 
        item.type === 'message' && Array.isArray((item as any).content)
      )
      for (const message of messageItems.reverse()) {
        const textItems = ((message as any).content as any[]).filter((item: any) => 
          item.type === 'output_text' && item.text
        )
        if (textItems.length > 0) {
          outputText = textItems[textItems.length - 1].text
          break
        }
      }
    }
    
    // Transform to JSON
    let transformed: any = { issues: [], auditedUrls: [] }
    
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        transformed = JSON.parse(jsonMatch[0])
      } else {
        transformed = await transformO3OutputToJSON(outputText, normalizedDomain, openai)
      }
    } catch (parseError) {
      transformed = await transformO3OutputToJSON(outputText, normalizedDomain, openai)
    }
    
    const usage = (finalResponse as any).usage
    
    console.log(`  📊 ${pass.name}: ${transformed.issues?.length || 0} issues found`)
    
    return {
      passName: pass.name,
      issues: transformed.issues || [],
      openedUrls: openedPages,
      toolCallsUsed,
      totalTokens: usage?.total_tokens,
      durationMs,
    }
    
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`  ❌ ${pass.name} failed: ${errorMessage}`)
    
    return {
      passName: pass.name,
      issues: [],
      openedUrls: [],
      toolCallsUsed: 0,
      durationMs,
      error: errorMessage,
    }
  }
}

// ============================================================================
// Main audit function - runs all passes and combines results
// ============================================================================

interface TestResult {
  domain: string
  approach: string
  toolCallsUsed: number
  maxToolCalls: number
  pagesOpened: number
  openedUrls: string[]
  issuesFound: number
  durationMs: number
  totalTokens?: number
  tokensPerPage?: number
  issuesPerPage?: number
  error?: string
  issueCategories?: Record<string, number>
  passResults?: PassResult[]
}

async function runO3Audit(domain: string): Promise<TestResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 1800000, // 30min timeout for 3 passes
  })
  
  const overallStartTime = Date.now()
  
  console.log(`\n${"=".repeat(60)}`)
  console.log(`Testing: ${domain}`)
  console.log(`Model: ${O3_CONFIG.model}`)
  console.log(`Transformer: ${TRANSFORMER_MODEL}`)
  console.log(`Strategy: Category-Specific Passes (${AUDIT_PASSES.length} passes)`)
  console.log(`${"=".repeat(60)}`)
  
  // Run all passes sequentially
  const passResults: PassResult[] = []
  
  for (let i = 0; i < AUDIT_PASSES.length; i++) {
    const pass = AUDIT_PASSES[i]
    console.log(`\n\n${"#".repeat(60)}`)
    console.log(`PASS ${i + 1}/${AUDIT_PASSES.length}: ${pass.name}`)
    console.log(`${"#".repeat(60)}`)
    
    const passResult = await runSingleAuditPass(domain, pass, openai)
    passResults.push(passResult)
    
    // Small delay between passes
    if (i < AUDIT_PASSES.length - 1) {
      console.log(`\n⏳ Waiting 5s before next pass...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
  
  const totalDurationMs = Date.now() - overallStartTime
  
  // Combine results from all passes
  const allIssues: any[] = []
  const allOpenedUrls = new Set<string>()
  let totalToolCalls = 0
  let totalTokens = 0
  const issueCategories: Record<string, number> = {}
  
  passResults.forEach(result => {
    allIssues.push(...result.issues)
    result.openedUrls.forEach(url => allOpenedUrls.add(url))
    totalToolCalls += result.toolCallsUsed
    if (result.totalTokens) {
      totalTokens += result.totalTokens
    }
  })
  
  // Count by category
  allIssues.forEach(issue => {
    const category = issue.category || 'uncategorized'
    issueCategories[category] = (issueCategories[category] || 0) + 1
  })
  
  // Results summary
  console.log(`\n\n${"=".repeat(60)}`)
  console.log(`COMBINED RESULTS`)
  console.log(`${"=".repeat(60)}`)
  
  console.log(`\n--- PASS BREAKDOWN ---`)
  passResults.forEach((result, i) => {
    const status = result.error ? '❌' : '✅'
    console.log(`${status} Pass ${i + 1} (${result.passName}): ${result.issues.length} issues, ${result.openedUrls.length} pages, ${(result.durationMs / 1000).toFixed(0)}s`)
    if (result.error) {
      console.log(`    Error: ${result.error}`)
    }
  })
  
  console.log(`\n--- TOTALS ---`)
  console.log(`Total pages opened: ${allOpenedUrls.size}`)
  console.log(`Total issues found: ${allIssues.length}`)
  console.log(`Total tool calls: ${totalToolCalls}`)
  console.log(`Total tokens: ${totalTokens.toLocaleString()}`)
  console.log(`Total duration: ${(totalDurationMs / 1000).toFixed(1)}s`)
  
  if (Object.keys(issueCategories).length > 0) {
    console.log(`\n--- ISSUE BREAKDOWN BY CATEGORY ---`)
    Object.entries(issueCategories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`))
  }
  
  // Save combined results
  const fs = await import('fs')
  const timestamp = Date.now()
  const issuesPath = `/tmp/audit-issues-${domain.replace(/\./g, '-')}-o3-category-specific-${timestamp}.json`
  fs.writeFileSync(issuesPath, JSON.stringify({
    domain,
    timestamp: new Date().toISOString(),
    model: O3_CONFIG.model,
    transformer: TRANSFORMER_MODEL,
    strategy: "category-specific-passes",
    pagesOpened: allOpenedUrls.size,
    totalIssues: allIssues.length,
    issues: allIssues,
    categories: issueCategories,
    openedUrls: Array.from(allOpenedUrls),
    toolCallsUsed: totalToolCalls,
    totalTokens,
    durationMs: totalDurationMs,
    passResults: passResults.map(r => ({
      passName: r.passName,
      issuesCount: r.issues.length,
      pagesOpened: r.openedUrls.length,
      toolCallsUsed: r.toolCallsUsed,
      durationMs: r.durationMs,
      error: r.error
    }))
  }, null, 2))
  console.log(`\n[SAVED] Combined issues saved to: ${issuesPath}`)
  
  // Check for errors
  const hasErrors = passResults.some(r => r.error)
  
  return {
    domain,
    approach: `o3-deep-research + ${TRANSFORMER_MODEL} (category-specific)`,
    toolCallsUsed: totalToolCalls,
    maxToolCalls: O3_CONFIG.maxToolCalls * AUDIT_PASSES.length,
    pagesOpened: allOpenedUrls.size,
    openedUrls: Array.from(allOpenedUrls),
    issuesFound: allIssues.length,
    durationMs: totalDurationMs,
    totalTokens,
    tokensPerPage: allOpenedUrls.size > 0 && totalTokens 
      ? Math.round(totalTokens / allOpenedUrls.size) 
      : 0,
    issuesPerPage: allOpenedUrls.size > 0 
      ? allIssues.length / allOpenedUrls.size 
      : 0,
    issueCategories,
    passResults,
    error: hasErrors ? `Some passes failed - see passResults` : undefined,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`\n${"#".repeat(60)}`)
  console.log(`# O3 DEEP RESEARCH + GPT-4.1 TRANSFORMER`)
  console.log(`# Category-Specific Content Audit`)
  console.log(`# Strategy: ${AUDIT_PASSES.length} focused passes`)
  console.log(`${"#".repeat(60)}`)
  
  if (!process.env.OPENAI_API_KEY) {
    console.error("\n❌ OPENAI_API_KEY not found in environment")
    process.exit(1)
  }
  
  // Parse CLI args
  const args = process.argv.slice(2)
  const siteToTest = args.filter(arg => !arg.startsWith('--'))[0] || TEST_SITES[0]
  
  console.log(`\nSite: ${siteToTest}`)
  console.log(`\nPasses to run:`)
  AUDIT_PASSES.forEach((pass, i) => {
    console.log(`  ${i + 1}. ${pass.name} (${pass.category})`)
  })
  
  const result = await runO3Audit(siteToTest)
  
  // Final Summary
  console.log(`\n\n${"=".repeat(60)}`)
  console.log(`FINAL SUMMARY`)
  console.log(`${"=".repeat(60)}`)
  console.log(`Domain: ${result.domain}`)
  console.log(`Total pages opened: ${result.pagesOpened}`)
  console.log(`Total issues found: ${result.issuesFound}`)
  console.log(`Tool calls: ${result.toolCallsUsed}/${result.maxToolCalls}`)
  console.log(`Duration: ${(result.durationMs / 1000 / 60).toFixed(1)} minutes`)
  console.log(`Total tokens: ${result.totalTokens?.toLocaleString() || 'N/A'}`)
  
  if (result.passResults) {
    console.log(`\n--- PER-PASS SUMMARY ---`)
    result.passResults.forEach((pass, i) => {
      console.log(`Pass ${i + 1} (${pass.passName}): ${pass.issues.length} issues, ${pass.openedUrls.length} pages`)
    })
  }
  
  if (result.error) {
    console.log(`\n⚠️  Warning: ${result.error}`)
  }
  
  if (result.issuesFound > 0) {
    console.log(`\n✅ Audit completed - ${result.issuesFound} issues found across ${result.pagesOpened} pages`)
  } else {
    console.log(`\n⚠️  No issues found - may need to review prompts`)
  }
}

main().catch(console.error)
