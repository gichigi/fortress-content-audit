/**
 * Firecrawl search helper for blog outline briefing
 * Provides recent context from web search to improve outline quality
 */

import Firecrawl from '@mendable/firecrawl-js'

const DEFAULT_LIMIT = 8
const FIRECRAWL_API_ENDPOINT = 'https://api.firecrawl.dev/v2/search'
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1500

/**
 * Search Firecrawl for recent context about a topic
 * @param {string} topic - The blog post topic/title
 * @param {string[]} keywords - Array of keywords to enhance search
 * @param {number} [limit=8] - Number of results to fetch
 * @returns {Promise<{ success: boolean, summary: string, markdown: string, urls: string[], error?: string } | null>}
 */
export async function searchBrief(topic, keywords = [], limit = DEFAULT_LIMIT) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.warn('⚠️  FIRECRAWL_API_KEY not set - skipping search briefing')
    return null
  }

  try {
    const keywordText = keywords.length > 0 ? keywords.slice(0, 3).join(' ') : ''
    const query = keywordText ? `${topic} ${keywordText}` : topic

    const searchPayload = {
      query,
      limit: limit || DEFAULT_LIMIT,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true
      }
    }

    const apiResult = await attemptFirecrawlRequestWithRetries(FIRECRAWL_API_ENDPOINT, apiKey, searchPayload)
    const formattedApi = formatFirecrawlResult(apiResult, limit)
    if (formattedApi) {
      return formattedApi
    }

    console.warn('⚠️  Firecrawl search returned no usable results')
    return null
  } catch (error) {
    console.warn('⚠️  Firecrawl search error:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

/**
 * Crawl a site (same-domain) up to a limit and return basic page contents
 * Uses official Firecrawl SDK
 * @param {string} startUrl
 * @param {number} limit
 * @returns {Promise<{ success: boolean, pages: { url: string, markdown?: string }[], error?: string }>}
 */
export async function crawlSite(startUrl, limit = 20) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    return { success: false, pages: [], error: 'Missing FIRECRAWL_API_KEY' }
  }
  
  console.log(`[Firecrawl] Using SDK (limit: ${limit} pages)`)
  
  try {
    const app = new Firecrawl({ apiKey })
    
    // Use SDK crawl method with automatic polling
    // pollInterval: 2 seconds (fast polling)
    // Temp: up to 3 pages for faster testing
    const actualLimit = Math.min(limit, 3)
    
    const crawlResponse = await app.crawl(startUrl, {
      limit: actualLimit,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true
      },
      pollInterval: 2 // Poll every 2 seconds (SDK handles this automatically)
    })
    
    console.log(`[Firecrawl] Crawl completed: status=${crawlResponse.status}, pages=${crawlResponse.data?.length || 0}`)
    
    // Extract pages from response
    // SDK returns: { status, data: [{ markdown, metadata: { sourceURL, title, ... } }] }
    const pages = []
    if (crawlResponse.data && Array.isArray(crawlResponse.data)) {
      for (const page of crawlResponse.data) {
        const url = page.metadata?.sourceURL || page.url
        const markdown = page.markdown || page.content
        if (url && markdown && markdown.length > 50) {
          console.log(`[Firecrawl] Found page: ${url} (${markdown.length} chars)`)
          pages.push({ url, markdown })
        }
      }
    }
    
    if (pages.length > 0) {
      console.log(`[Firecrawl] Successfully extracted ${pages.length} pages`)
      return { success: true, pages }
    }
    
    return { success: false, pages: [], error: 'Firecrawl returned no pages' }
  } catch (e) {
    console.error(`[Firecrawl] SDK error:`, e instanceof Error ? e.message : 'Unknown error')
    return { success: false, pages: [], error: e instanceof Error ? e.message : 'Crawl failed' }
  }
}

/**
 * Scrape a single URL and return markdown content
 * @param {string} url
 * @returns {Promise<{ success: boolean, markdown?: string, error?: string }>}
 */
export async function scrapeUrl(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Missing FIRECRAWL_API_KEY' }
  }

  try {
    const app = new Firecrawl({ apiKey })
    const scrapeResponse = await app.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true
    })

    const markdown = scrapeResponse.markdown || scrapeResponse.data?.markdown
    if (markdown && markdown.length > 50) {
      console.log(`[Firecrawl] Scraped ${url} (${markdown.length} chars)`)
      return { success: true, markdown }
    }

    return { success: false, error: 'Firecrawl returned no markdown' }
  } catch (e) {
    console.error(`[Firecrawl] Scrape error for ${url}:`, e instanceof Error ? e.message : 'Unknown error')
    return { success: false, error: e instanceof Error ? e.message : 'Scrape failed' }
  }
}

/**
 * Map a site to discover URLs without scraping content
 * @param {string} startUrl
 * @param {number} limit
 * @returns {Promise<{ success: boolean, pages: { url: string, title?: string }[], error?: string }>}
 */
export async function mapSite(startUrl, limit = 150) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    return { success: false, pages: [], error: 'Missing FIRECRAWL_API_KEY' }
  }

  try {
    const app = new Firecrawl({ apiKey })
    const mapResponse = await app.map(startUrl, {
      limit,
      ignoreSitemap: false,
      includeSubdomains: false,
    })

    const pages = []
    if (mapResponse?.links && Array.isArray(mapResponse.links)) {
      for (const link of mapResponse.links) {
        if (link?.url) {
          pages.push({
            url: link.url,
            title: link.title || null,
          })
        }
      }
    }

    return { success: true, pages }
  } catch (e) {
    console.error(`[Firecrawl] Map error:`, e instanceof Error ? e.message : 'Unknown error')
    return { success: false, pages: [], error: e instanceof Error ? e.message : 'Map failed' }
  }
}

async function attemptFirecrawlRequestWithRetries(endpoint, apiKey, payload) {
  let attempt = 0
  let lastResponse = null

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      })

      lastResponse = response

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`⚠️  Firecrawl API request failed (attempt ${attempt + 1} / ${MAX_RETRIES + 1}): ${response.status} ${errorText}`)
      } else {
        return await response.json()
      }
    } catch (error) {
      console.warn(`⚠️  Firecrawl API request error (attempt ${attempt + 1} / ${MAX_RETRIES + 1}):`, error instanceof Error ? error.message : 'Unknown error')
    }

    attempt += 1
    if (attempt <= MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      console.log(`   🔄 Retrying Firecrawl API (attempt ${attempt + 1} of ${MAX_RETRIES + 1})...`)
    }
  }

  if (lastResponse) {
    console.warn(`⚠️  Firecrawl API ultimately failed with status: ${lastResponse.status}`)
  }

  return null
}

/**
 * Extract main content from markdown, skipping navigation and headers
 */
function extractMainContent(markdown) {
  if (!markdown) return ''
  
  // Split into lines and filter out common navigation/header patterns
  const lines = markdown.split('\n')
  const contentLines = []
  let skipNext = false
  let foundMainContent = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip navigation patterns
    if (line.match(/^(Skip to|Table of Contents|Share|Agree & Join|Would you like|Try .* for free|Free account)/i)) {
      skipNext = true
      continue
    }
    
    // Skip markdown link patterns that are navigation
    if (line.match(/\[Skip to.*\]\(.*#/)) {
      continue
    }
    
    // Skip image-only lines (markdown images)
    if (line.match(/^!\[.*\]\(http/)) {
      continue
    }
    
    // Skip social sharing links
    if (line.match(/^(Facebook|Twitter|LinkedIn|Email|Copy Link)/i)) {
      continue
    }
    
    // Skip cookie/legal notices
    if (line.match(/(User Agreement|Privacy Policy|Cookie Policy|By clicking)/i)) {
      skipNext = true
      continue
    }
    
    // Skip empty lines after skipped content
    if (skipNext && line === '') {
      continue
    }
    
    skipNext = false
    
    // Start collecting after we see actual content (paragraphs with substantial text)
    if (!foundMainContent && line.length > 100 && !line.match(/^[#!\[\-]/)) {
      foundMainContent = true
    }
    
    // Only collect content after we've found the main content start
    if (foundMainContent || line.match(/^##/)) {
      contentLines.push(lines[i])
    }
  }
  
  return contentLines.join('\n')
}

/**
 * Extract the most relevant paragraphs from markdown content
 */
function extractRelevantContent(markdown, maxChars = 1200) {
  const mainContent = extractMainContent(markdown)
  
  // Split into paragraphs
  const paragraphs = mainContent.split(/\n\s*\n/).filter(p => p.trim().length > 50)
  
  // Take first few substantial paragraphs (usually intro/content)
  let extracted = ''
  for (const para of paragraphs) {
    if (extracted.length + para.length > maxChars) break
    extracted += para + '\n\n'
  }
  
  return extracted.trim()
}

function formatFirecrawlResult(data, limit) {
  if (!data) {
    return null
  }

  const webResults = extractWebResults(data)
  if (!webResults || webResults.length === 0) {
    return null
  }

  const trimmedResults = webResults.slice(0, limit || DEFAULT_LIMIT)
  const urls = []
  const summaries = []
  const fullMarkdowns = []

  for (const rawResult of trimmedResults) {
    const result = normalizeResult(rawResult)
    if (!result) continue

    if (result.url) {
      urls.push(result.url)
    }

    const markdownSource = result.markdown || result.content
    if (!markdownSource) continue

    // Extract relevant content (skip nav/headers, get actual paragraphs)
    const relevantContent = extractRelevantContent(markdownSource, 1200)
    
    // Build summary for outline agent
    let summary = ''
    if (result.title) {
      summary += `**${result.title}**\n\n`
    }
    if (result.description) {
      summary += `${result.description}\n\n`
    }
    if (relevantContent) {
      summary += `Key insights and content:\n${relevantContent.substring(0, 1000)}${relevantContent.length > 1000 ? '...' : ''}`
    }

    if (summary.trim().length > 0) {
      summaries.push(summary.trim())
    }
    
    // Store full markdown for writer agent
    if (markdownSource) {
      fullMarkdowns.push({
        url: result.url,
        title: result.title,
        markdown: markdownSource
      })
    }
  }

  if (summaries.length === 0) {
    return null
  }

  return {
    success: true,
    summary: summaries.join('\n\n---\n\n'),
    markdown: fullMarkdowns, // Full markdown for writer agent
    urls
  }
}

function extractWebResults(data) {
  if (!data) {
    return []
  }

  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data.web)) {
    return data.web
  }

  if (Array.isArray(data.results)) {
    return data.results
  }

  if (data.data) {
    return extractWebResults(data.data)
  }

  if (data.response) {
    return extractWebResults(data.response)
  }

  return []
}

function normalizeResult(result) {
  if (!result || typeof result !== 'object') {
    return null
  }

  const url = result.url || result.link || null
  const title = result.title || null
  const description = result.description || null
  const markdown = result.markdown || result.content || null

  if (!url && !title && !description && !markdown) {
    return null
  }

  return {
    url: url || undefined,
    title: title || undefined,
    description: description || undefined,
    markdown: markdown || undefined
  }
}
