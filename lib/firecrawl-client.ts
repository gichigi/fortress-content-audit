/**
 * Firecrawl API Client
 * Handles web crawling with bot protection and JS rendering
 * Uses dynamic import for @mendable/firecrawl-js to prevent module-level failures
 * from breaking all exports (e.g. isFirecrawlAvailable)
 */

import Logger from './logger'

// Dynamic import to avoid module-level failures poisoning all exports
const getFirecrawlClient = async () => {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    throw new Error(
      'FIRECRAWL_API_KEY not found in environment variables. ' +
      'Add FIRECRAWL_API_KEY=your_key to .env.local or .env file. ' +
      'Get your API key from https://firecrawl.dev'
    )
  }
  const { default: FirecrawlApp } = await import('@mendable/firecrawl-js')
  return new FirecrawlApp({ apiKey })
}

/**
 * Check if Firecrawl is available (API key configured)
 */
export function isFirecrawlAvailable(): boolean {
  return !!process.env.FIRECRAWL_API_KEY
}

export interface FirecrawlPage {
  url: string
  markdown?: string
  html?: string
  links?: string[]
  metadata?: {
    title?: string
    description?: string
    statusCode?: number
  }
}

export interface CrawlOptions {
  limit?: number
  maxDepth?: number
  includePaths?: string[]
  excludePaths?: string[]
  onlyMainContent?: boolean
}

/**
 * Crawl a website and return pages with markdown content
 */
export async function crawlWebsite(
  url: string,
  options: CrawlOptions = {}
): Promise<FirecrawlPage[]> {
  const {
    limit = 20,
    maxDepth = 3,
    includePaths,
    excludePaths,
    onlyMainContent = true
  } = options

  const firecrawl = await getFirecrawlClient()

  try {
    Logger.info(`[Firecrawl] Starting crawl of ${url} (limit: ${limit})`)
    const startTime = Date.now()

    const result = await firecrawl.crawl(url, {
      limit,
      maxDepth,
      includePaths,
      excludePaths,
      scrapeOptions: {
        formats: ['markdown', 'links'],
        onlyMainContent
      }
    })

    const duration = Date.now() - startTime
    Logger.info(`[Firecrawl] Crawl completed in ${(duration / 1000).toFixed(1)}s: ${result.data?.length || 0} pages`)

    return result.data || []
  } catch (error) {
    Logger.error('[Firecrawl] Crawl failed', error instanceof Error ? error : undefined)
    throw error
  }
}

/**
 * Map a website to discover all URLs
 * Returns array of URL strings or objects with url property
 */
export async function mapWebsite(url: string): Promise<Array<string | { url: string; title?: string; description?: string }>> {
  const firecrawl = await getFirecrawlClient()

  try {
    Logger.info(`[Firecrawl] Mapping ${url}`)
    const startTime = Date.now()

    const result = await firecrawl.map(url, {
      includeSubdomains: false,
      limit: 1000
    })

    const duration = Date.now() - startTime
    const urls = result.links || []
    Logger.info(`[Firecrawl] Map completed in ${(duration / 1000).toFixed(1)}s: ${urls.length} URLs found`)

    return urls
  } catch (error) {
    Logger.error('[Firecrawl] Map failed', error instanceof Error ? error : undefined)
    throw error
  }
}

// JS to strip hidden elements before extraction (see ADR-001).
// Runs in browser context where getComputedStyle resolves all CSS
// including Tailwind responsive classes and media queries.
// Also strips sr-only / visually-hidden elements and aria-hidden content.
const STRIP_HIDDEN_ELEMENTS_SCRIPT = `
  // Phase 1: Strip by class/attribute (sr-only, visually-hidden, aria-hidden)
  document.querySelectorAll('.sr-only, .visually-hidden, [aria-hidden="true"]').forEach(el => {
    el.remove();
  });

  // Phase 2: Strip by computed style (display:none, visibility:hidden, zero-size)
  document.querySelectorAll('*').forEach(el => {
    try {
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        (el.offsetHeight === 0 && el.offsetWidth === 0)
      ) {
        el.remove();
        return;
      }
      // Catch clip-based hiding patterns (position:absolute + clip rect)
      if (
        style.position === 'absolute' &&
        style.overflow === 'hidden' &&
        el.offsetWidth <= 1 &&
        el.offsetHeight <= 1
      ) {
        el.remove();
      }
    } catch (e) {}
  });
`

/**
 * Scrape a single page
 * Strips hidden elements (responsive duplicates) before extraction
 */
export async function scrapePage(url: string): Promise<FirecrawlPage> {
  const firecrawl = await getFirecrawlClient()

  try {
    const result = await firecrawl.scrape(url, {
      formats: ['markdown', 'links', 'html'],
      onlyMainContent: true,
      actions: [
        { type: 'wait', milliseconds: 500 },
        { type: 'executeJavascript' as any, script: STRIP_HIDDEN_ELEMENTS_SCRIPT },
        { type: 'wait', milliseconds: 200 },
      ]
    })

    return {
      url,
      markdown: result.markdown,
      html: result.html,
      links: result.links,
      metadata: result.metadata
    }
  } catch (error) {
    Logger.error(`[Firecrawl] Scrape failed for ${url}`, error instanceof Error ? error : undefined)
    throw error
  }
}
