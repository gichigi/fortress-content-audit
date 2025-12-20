#!/usr/bin/env tsx
/**
 * Test script for content audit using Puppeteer extraction and web search
 * 
 * Usage:
 *   npx tsx scripts/test-puppeteer-audit.ts <domain>
 * 
 * Example:
 *   npx tsx scripts/test-puppeteer-audit.ts vercel.com
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { OpenAI } from 'openai'
import puppeteer from 'puppeteer'

function normalizeDomain(domain: string): string {
  if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
    return `https://${domain}`
  }
  return domain
}

function extractDomainForFilter(domain: string): string {
  try {
    const url = new URL(domain)
    return url.hostname
  } catch {
    return domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

// Puppeteer function to fetch and render web pages
async function fetchWebPage(url: string, targetDomain?: string): Promise<string> {
  // Validate URL is within target domain
  if (targetDomain) {
    try {
      const urlObj = new URL(url)
      const targetHostname = extractDomainForFilter(targetDomain)
      if (urlObj.hostname !== targetHostname && !urlObj.hostname.endsWith(`.${targetHostname}`)) {
        return JSON.stringify({ 
          error: `URL ${url} is outside allowed domain ${targetDomain}` 
        })
      }
    } catch (e) {
      return JSON.stringify({ error: `Invalid URL: ${url}` })
    }
  }

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // Set desktop viewport to avoid responsive design duplicates
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    })
    
    // Suppress JS errors and console messages - don't let them block extraction
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    // Suppress page errors - they won't block extraction
    page.on('pageerror', (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      consoleErrors.push(`Page error: ${errorMessage}`)
    })
    
    // Inject fix for common JS errors before navigation
    await page.evaluateOnNewDocument(() => {
      // Fix for __name is not defined errors (common in Next.js/React apps)
      if (typeof window !== 'undefined' && !(window as any).__name) {
        (window as any).__name = ''
      }
      // Suppress other common undefined variable errors
      const originalError = console.error
      console.error = (...args: any[]) => {
        // Don't throw on undefined variable errors
        if (args.some(arg => typeof arg === 'string' && arg.includes('is not defined'))) {
          return
        }
        originalError.apply(console, args)
      }
    })
    
    // Set a reasonable timeout
    let navigationSuccess = true
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    }).catch((err) => {
      // Continue even if navigation has issues - page might still be partially loaded
      navigationSuccess = false
      console.warn(`Navigation warning: ${err instanceof Error ? err.message : 'Unknown'}`)
    })
    
    // Wait for any dynamic content to load and JS to settle
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Try to wait for specific elements that indicate page is loaded
    try {
      await page.waitForSelector('body', { timeout: 5000 })
    } catch {
      // Body should always exist, but continue anyway
    }
    
    // Extract full rendered HTML (even if navigation had issues)
    let html = ''
    let cleanedHtml = ''
    
    try {
      html = await page.content()
      
      // Clean HTML: remove scripts, styles, but keep structure
      cleanedHtml = await page.evaluate(() => {
        // Clone the document to avoid modifying the original
        const clone = document.cloneNode(true) as Document
        
        // Remove script and style elements
        const scripts = clone.querySelectorAll('script, style, noscript, iframe')
        scripts.forEach(el => el.remove())
        
        // Remove inline event handlers and data attributes that add noise
        const allElements = clone.querySelectorAll('*')
        allElements.forEach(el => {
          // Remove event handlers
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || 
                attr.name.startsWith('data-') && !['data-testid', 'data-id'].includes(attr.name)) {
              el.removeAttribute(attr.name)
            }
          })
        })
        
        // Return cleaned HTML
        return clone.documentElement.outerHTML
      })
    } catch (err) {
      console.warn(`Failed to extract HTML: ${err instanceof Error ? err.message : 'Unknown'}`)
      // Fallback to basic HTML extraction
      try {
        html = await page.content()
        // Basic cleaning: remove script/style tags
        cleanedHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      } catch (e) {
        console.warn(`Failed to extract HTML: ${e instanceof Error ? e.message : 'Unknown'}`)
      }
    }
    
    // Extract basic metadata for summary
    let metadata: any = null
    try {
      metadata = await page.evaluate(() => {
        return {
          title: document.title || '',
          metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      })
    } catch (err) {
      console.warn(`Failed to extract metadata: ${err instanceof Error ? err.message : 'Unknown'}`)
      metadata = {
        title: '',
        metaDescription: '',
        viewport: { width: 1920, height: 1080 }
      }
    }
    
    await browser.close()
    
    // Return cleaned HTML for analysis
    // Limit HTML size to stay within token limits (keep first 100k chars which should be enough for homepage)
    const htmlToAnalyze = cleanedHtml || html
    const limitedHtml = htmlToAnalyze.substring(0, 100000)
    
    return JSON.stringify({
      url,
      html: limitedHtml,
      htmlLength: htmlToAnalyze.length,
      metadata: metadata || {},
      consoleErrors: consoleErrors.length > 0 ? consoleErrors : undefined,
      navigationSuccess,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    if (browser) await browser.close()
    return JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      url 
    })
  }
}

const AUDIT_PROMPT = `Audit the provided HTML pages for errors and issues.

Find:
• Content errors: typos, grammar, punctuation, factual inconsistencies
• Technical issues: broken links, SEO gaps, accessibility problems, terminology inconsistencies

Rules:
- HTML is fully rendered - analyze structure and content
- Only report issues you are certain are errors
- Ignore subjective style preferences
- For each issue, specify which page URL it was found on

For each issue, provide:
- Title, URL, snippet, suggested fix
- Category: 'typos', 'grammar', 'punctuation', 'seo', 'factual', 'links', 'terminology'
- Severity: 'low', 'medium', or 'high'`

// Function to identify key pages using web search with gpt-4o-mini via responses API
async function identifyKeyPages(targetDomain: string, openai: OpenAI): Promise<string[]> {
  try {
    console.log('Searching web for key pages using gpt-4o-mini...')
    
    const domainHostname = extractDomainForFilter(targetDomain)
    // Handle notion.com -> notion.so redirect
    const searchDomain = domainHostname === 'notion.com' ? 'notion.so' : domainHostname
    const searchQuery = `site:${searchDomain}`
    
    const params: any = {
      model: "gpt-4o-mini",
      input: `Search the web for: ${searchQuery}

List the top 3 most important page URLs from the search results. Return ONLY the URLs, one per line.`,
      tools: [{
        type: "web_search_preview"
      }],
      max_tool_calls: 3, // Limit to keep it fast/cheap
      max_output_tokens: 2000,
      include: ["web_search_call.action.sources"], // Request sources to get URLs
    }
    
    const response = await openai.responses.create(params)
    
    // Poll for completion (simple synchronous wait)
    let status = response.status as string
    let finalResponse = response
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max
    
    while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      finalResponse = await openai.responses.retrieve(response.id)
      status = finalResponse.status as string
      attempts++
    }
    
    if (status !== "completed") {
      console.log(`⚠️  Search did not complete (status: ${status}), falling back to homepage only`)
      return []
    }
    
    // Extract URLs from response output
    const outputText = finalResponse.output_text || ''
    
    // Debug: log the raw output
    if (!outputText || outputText.trim().length === 0) {
      console.log('⚠️  Empty output from web search, falling back to homepage only')
      return []
    }
    
    // Try to extract URLs from the output text (one per line or space-separated)
    const urlPattern = /https?:\/\/[^\s"<>\)\n]+/g
    let foundUrls = outputText.match(urlPattern) || []
    
    // If no URLs found, try to extract from sources in the response
    if (foundUrls.length === 0 && finalResponse.output && Array.isArray(finalResponse.output)) {
      for (const item of finalResponse.output) {
        if (item.type === 'web_search_call' && item.action?.sources) {
          const sources = item.action.sources
          if (Array.isArray(sources)) {
            sources.forEach((source: any) => {
              const sourceUrl = typeof source === 'string' ? source : source.url || source
              if (sourceUrl && typeof sourceUrl === 'string' && sourceUrl.startsWith('http')) {
                foundUrls.push(sourceUrl)
              }
            })
          }
        }
      }
    }
    
    // Filter to same domain and exclude homepage
    // Handle both .com and .so for notion
    const normalizedHomepage = normalizeDomain(targetDomain)
    const allowedHostnames = domainHostname === 'notion.com' 
      ? ['notion.com', 'notion.so', 'www.notion.com', 'www.notion.so']
      : [domainHostname, `www.${domainHostname}`]
    
    const keyPages = foundUrls
      .filter((url: string) => {
        try {
          const urlObj = new URL(url)
          const urlHostname = urlObj.hostname
          return allowedHostnames.some(allowed => 
            urlHostname === allowed || urlHostname.endsWith(`.${allowed}`)
          )
        } catch {
          return false
        }
      })
      .filter((url: string) => {
        const normalized = normalizeDomain(url)
        // Exclude homepage (both .com and .so versions)
        return normalized !== normalizedHomepage && 
               normalized !== normalizedHomepage.replace('.com', '.so') &&
               normalized !== normalizedHomepage.replace('.so', '.com')
      })
      .slice(0, 3) // Take top 3

    if (keyPages.length > 0) {
      console.log(`✓ Found ${keyPages.length} key page(s) from search: ${keyPages.join(', ')}`)
    } else {
      console.log(`⚠️  No valid key pages found in search results (found ${foundUrls.length} URLs total), falling back to homepage only`)
      if (outputText) {
        console.log(`   Raw output: ${outputText.substring(0, 200)}...`)
      }
    }
    
    return keyPages
  } catch (error) {
    console.log(`⚠️  Error searching for key pages: ${error instanceof Error ? error.message : 'Unknown'}, falling back to homepage only`)
    return []
  }
}

async function testPuppeteerAudit(domain: string) {
  const startTime = Date.now()
  
  console.log(`\n=== Testing GPT-5.2 with Puppeteer-extracted HTML for: ${domain} ===\n`)
  
  const normalizedDomain = normalizeDomain(domain)
  const domainForFilter = extractDomainForFilter(normalizedDomain)
  
  console.log(`Normalized domain: ${normalizedDomain}`)
  console.log(`Domain filter: ${domainForFilter}\n`)
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 300000, // 5min timeout
  })
  
  // Step 1: Search web for key pages using cheap model
  const keyPages = await identifyKeyPages(normalizedDomain, openai)
  
  // Step 2: Extract homepage and key pages with Puppeteer
  console.log(`\nStep 2: Extracting pages with Puppeteer (homepage + ${keyPages.length} key page(s))...`)
  const extractionStart = Date.now()
  
  // Extract homepage
  const homepageContent = await fetchWebPage(normalizedDomain, normalizedDomain)
  let homepageParsed
  try {
    homepageParsed = JSON.parse(homepageContent)
  } catch (e) {
    console.error('Failed to parse homepage content:', e)
    process.exit(1)
  }
  
  if (homepageParsed.error) {
    console.error(`Error extracting homepage: ${homepageParsed.error}`)
    console.error('This might be a JavaScript error on the page. Continuing anyway...')
  }
  
  if (!homepageParsed.html) {
    console.error('No HTML extracted from homepage')
    process.exit(1)
  }
  
  const extractionDuration = Date.now() - extractionStart
  
  // Extract key pages with Puppeteer
  const allPages: Array<{url: string, html: string, title: string}> = [
    {
      url: homepageParsed.url,
      html: homepageParsed.html,
      title: homepageParsed.metadata?.title || 'Homepage'
    }
  ]
  
  for (const pageUrl of keyPages) {
    try {
      const pageContent = await fetchWebPage(pageUrl, normalizedDomain)
      const parsed = JSON.parse(pageContent)
      if (parsed.html && !parsed.error) {
        allPages.push({
          url: parsed.url,
          html: parsed.html,
          title: parsed.metadata?.title || pageUrl
        })
        console.log(`✓ Extracted: ${pageUrl}`)
      } else {
        console.log(`⚠️  Failed to extract: ${pageUrl}`)
      }
    } catch (e) {
      console.log(`⚠️  Error extracting ${pageUrl}: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }
  
  console.log(`\nTotal pages extracted: ${allPages.length} in ${(extractionDuration / 1000).toFixed(2)}s\n`)
  
  // Step 3: Build prompt with all pages for cross-auditing
  const pagesHtml = allPages.map((page, idx) => {
    const htmlLimit = 40000 // Limit each page to 40k chars to stay within token limits (all pages at once)
    return `=== PAGE ${idx + 1}: ${page.title} ===
URL: ${page.url}
HTML (cleaned, scripts/styles removed, first ${htmlLimit} chars):
${page.html.substring(0, htmlLimit)}`
  }).join('\n\n')

  const input = `${AUDIT_PROMPT}

Cross-audit the following ${allPages.length} page(s) for errors and inconsistencies:

${pagesHtml}

Report all issues found, specifying the URL for each issue. Check for cross-page inconsistencies in terminology, branding, and factual information.`

  try {
    console.log('Sending content to GPT-5.2 for analysis...\n')
    
    const responseStart = Date.now()
    const response = await openai.chat.completions.create({
      model: "gpt-5.2-2025-12-11",
      messages: [
        { role: "user", content: input }
      ],
      max_completion_tokens: 16000,
      reasoning_effort: "high",
    })
    const responseDuration = Date.now() - responseStart
    
    console.log(`\n=== RESPONSE ===\n`)
    console.log(`Model: ${response.model}`)
    console.log(`Analysis duration: ${(responseDuration / 1000).toFixed(2)}s`)
    console.log(`Status: ${response.choices[0]?.finish_reason || 'unknown'}`)
    
    if (response.usage) {
      console.log(`\nToken Usage:`)
      console.log(`  Input: ${response.usage.prompt_tokens?.toLocaleString() || 'N/A'}`)
      console.log(`  Output: ${response.usage.completion_tokens?.toLocaleString() || 'N/A'}`)
      console.log(`  Total: ${response.usage.total_tokens?.toLocaleString() || 'N/A'}`)
    }
    
    const message = response.choices[0]?.message
    if (message) {
      console.log(`\nContent length: ${message.content?.length || 0} chars`)
      
      if (message.content) {
        console.log(`\n=== OUTPUT TEXT ===\n`)
        console.log(message.content)
      }
    }
    
    const totalTime = Date.now() - startTime
    console.log(`\n=== SUMMARY ===\n`)
    console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`)
    console.log(`  - Extraction: ${(extractionDuration / 1000).toFixed(2)}s`)
    console.log(`  - Analysis: ${(responseDuration / 1000).toFixed(2)}s`)
    
  } catch (error) {
    console.error(`\n❌ Error:`, error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error(`Stack:`, error.stack)
    }
    process.exit(1)
  }
}

// Main execution
async function main() {
  const domain = process.argv[2]
  
  if (!domain) {
    console.error('Usage: npx tsx scripts/test-puppeteer-audit.ts <domain>')
    console.error('Example: npx tsx scripts/test-puppeteer-audit.ts vercel.com')
    process.exit(1)
  }
  
  await testPuppeteerAudit(domain)
}

main().catch(console.error)

