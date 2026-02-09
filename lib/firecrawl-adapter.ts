/**
 * Adapter to make Firecrawl output compatible with existing audit system
 * Implements Map → selectPagesToAudit → Scrape architecture for intelligent page selection
 */

import { mapWebsite, scrapePage, isFirecrawlAvailable, FirecrawlPage } from './firecrawl-client'
import { selectPagesToAudit } from './page-selector'
import { crawlLinks, type CrawlerIssue } from './link-crawler'
import Logger from './logger'

// Fallback to old method when Firecrawl unavailable
import {
  extractElementManifest,
  formatManifestForPrompt as formatManifestLegacy,
  countInternalPages,
  extractDiscoveredPagesList
} from './manifest-extractor'

export interface AuditManifest {
  pages: FirecrawlPage[]
  discoveredUrls: string[]
  pagesFound: number
  linkValidationIssues?: CrawlerIssue[]
}

/**
 * Extract hostname from domain string
 */
function extractDomainHostname(domain: string): string {
  try {
    const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    return url.hostname
  } catch {
    return domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

/**
 * Fallback: Use legacy manifest extractor when Firecrawl unavailable
 */
async function extractWithLegacyManifest(
  domain: string,
  tier: 'FREE' | 'PAID',
  includeLongform: boolean
): Promise<AuditManifest> {
  Logger.info('[Fallback] Using legacy manifest-extractor')

  // Ensure domain has protocol
  const normalizedDomain = domain.startsWith('http') ? domain : `https://${domain}`
  const manifests = await extractElementManifest(normalizedDomain)
  const discoveredUrls = extractDiscoveredPagesList(manifests)
  const domainHostname = extractDomainHostname(domain)

  // Apply same intelligent selection
  const selectedUrls = await selectPagesToAudit(
    discoveredUrls,
    domainHostname,
    tier,
    includeLongform
  )

  // Convert legacy manifests to Firecrawl-style pages
  const pages: FirecrawlPage[] = manifests
    .filter(m => selectedUrls.includes(m.page_url))
    .map(m => {
      // Convert links to markdown format for link crawler
      const markdownLinks = m.links
        .map(link => `[${link.text}](${link.href})`)
        .join('\n')

      return {
        url: m.page_url,
        markdown: formatManifestLegacy([m]) + '\n\n' + markdownLinks,
        metadata: {
          title: m.headings[0]?.text || undefined
        }
      }
    })

  // Run link crawler even in fallback mode (uses hybrid approach)
  Logger.debug(`[Fallback] Running link crawler on ${pages.length} pages...`)
  const linkValidationIssues = await crawlLinks(pages, domain, {
    concurrency: tier === 'FREE' ? 3 : 5,
    checkExternal: tier === 'PAID', // Only check external links on paid tier
    maxLinks: tier === 'FREE' ? 50 : 200,
    timeoutMs: 8000
  })
  Logger.info(`[LinkCrawler] Found ${linkValidationIssues.length} link issues`)

  return {
    pages,
    discoveredUrls,
    pagesFound: countInternalPages(manifests),
    linkValidationIssues
  }
}

/**
 * Extract content using Firecrawl with intelligent page selection
 * Architecture: Map (discover) → selectPagesToAudit (intelligence) → Scrape (parallel)
 * Falls back to manifest-extractor if Firecrawl API key not configured
 */
export async function extractWithFirecrawl(
  domain: string,
  tier: 'FREE' | 'PAID' = 'FREE',
  includeLongform: boolean = false
): Promise<AuditManifest> {
  // Fallback to legacy method if Firecrawl not available
  if (!isFirecrawlAvailable()) {
    Logger.warn('[Firecrawl] API key not configured, falling back to manifest-extractor')
    return extractWithLegacyManifest(domain, tier, includeLongform)
  }

  const limit = tier === 'FREE' ? 6 : 20

  try {
    // Phase 1: Map - Discover all URLs on the site
    Logger.debug(`[Firecrawl] Phase 1: Mapping URLs from ${domain}...`)
    const mapResults = await mapWebsite(domain)
    // Extract URL strings from map results (Firecrawl returns {url, title, description})
    const allUrls = mapResults.map(r => typeof r === 'string' ? r : r.url || r)
    Logger.debug(`[Firecrawl] Discovered ${allUrls.length} URLs`)

    // Phase 2: Smart Selection - Use our intelligent page selector
    const domainHostname = extractDomainHostname(domain)
    const selectedUrls = await selectPagesToAudit(
      allUrls,
      domainHostname,
      tier,
      includeLongform
    )
    Logger.debug(`[Firecrawl] Selected ${selectedUrls.length}/${allUrls.length} pages for audit`)

    // Phase 3: Parallel Scrape - Fetch content for selected pages
    Logger.debug(`[Firecrawl] Phase 3: Scraping ${selectedUrls.length} selected pages...`)
    const scrapePromises = selectedUrls.map(url =>
      scrapePage(url).catch(err => {
        Logger.warn(`[Firecrawl] Failed to scrape ${url}:`, err)
        return null
      })
    )
    const scrapeResults = await Promise.all(scrapePromises)
    const pages = scrapeResults.filter((p): p is FirecrawlPage => p !== null)

    Logger.info(`[Firecrawl] Successfully scraped ${pages.length}/${selectedUrls.length} pages (discovered ${allUrls.length} total URLs)`)

    // Phase 4: HTTP Link Crawler - Check links via actual HTTP requests
    Logger.debug(`[Firecrawl] Phase 4: Crawling links from scraped pages...`)
    const linkValidationIssues = await crawlLinks(pages, domain, {
      concurrency: tier === 'FREE' ? 3 : 5,
      checkExternal: tier === 'PAID', // Only check external links on paid tier
      maxLinks: tier === 'FREE' ? 50 : 200,
      timeoutMs: 8000
    })
    Logger.info(`[LinkCrawler] Found ${linkValidationIssues.length} link issues`)

    return {
      pages,
      discoveredUrls: allUrls, // Already extracted as strings above
      pagesFound: allUrls.length,
      linkValidationIssues
    }
  } catch (error) {
    Logger.error('[Firecrawl] Extraction failed', error instanceof Error ? error : undefined)

    // Fallback to legacy if Firecrawl fails (e.g., out of credits, network error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Insufficient credits') || errorMessage.includes('credit')) {
      Logger.warn('[Firecrawl] Out of credits, falling back to manifest-extractor')
      return extractWithLegacyManifest(domain, tier, includeLongform)
    }

    throw error
  }
}

/**
 * Format Firecrawl pages for audit prompts (replaces formatManifestForPrompt)
 */
export function formatFirecrawlForPrompt(manifest: AuditManifest): string {
  const { pages } = manifest

  if (pages.length === 0) {
    return '# WEBSITE CONTENT\n\nNo content available (extraction failed).\n'
  }

  let output = '# WEBSITE CONTENT\n\n'
  output += `Extracted from ${pages.length} pages using Firecrawl (bot-protected crawling).\n\n`

  pages.forEach((page, index) => {
    output += `## Page ${index + 1}: ${page.url}\n\n`

    if (page.metadata?.title) {
      output += `**Title:** ${page.metadata.title}\n\n`
    }

    if (page.metadata?.description) {
      output += `**Description:** ${page.metadata.description}\n\n`
    }

    if (page.markdown) {
      // Limit content length to avoid token limits
      const contentPreview = page.markdown.length > 8000
        ? page.markdown.substring(0, 8000) + '\n\n[Content truncated...]'
        : page.markdown

      output += `**Content:**\n${contentPreview}\n\n`
    }

    output += '---\n\n'
  })

  return output
}

/**
 * Get audited URLs from manifest
 */
export function getAuditedUrls(manifest: AuditManifest): string[] {
  return manifest.pages.map(p => p.url)
}

/**
 * Count pages found (replaces countInternalPages)
 */
export function countPagesFound(manifest: AuditManifest): number {
  return manifest.pagesFound
}

/**
 * Get discovered pages list (replaces extractDiscoveredPagesList)
 */
export function getDiscoveredPages(manifest: AuditManifest): string[] {
  return manifest.discoveredUrls
}
