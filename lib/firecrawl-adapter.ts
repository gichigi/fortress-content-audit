/**
 * Adapter to make Firecrawl output compatible with existing audit system
 * Bridges Firecrawl pages to manifest format for minimal audit.ts changes
 */

import { crawlWebsite, mapWebsite, FirecrawlPage } from './firecrawl-client'
import Logger from './logger'

export interface AuditManifest {
  pages: FirecrawlPage[]
  discoveredUrls: string[]
  pagesFound: number
}

/**
 * Extract content using Firecrawl (replaces extractElementManifest)
 */
export async function extractWithFirecrawl(
  domain: string,
  tier: 'FREE' | 'PAID' = 'FREE'
): Promise<AuditManifest> {
  const limit = tier === 'FREE' ? 6 : 20

  try {
    // Option 1: Simple crawl (let Firecrawl decide which pages)
    const pages = await crawlWebsite(domain, {
      limit,
      maxDepth: 3,
      onlyMainContent: true,
      excludePaths: [
        '^/admin',
        '^/login',
        '^/signup',
        '^/api',
        '\\.(pdf|zip|exe|dmg)$'
      ]
    })

    // Extract all discovered URLs from crawled pages
    const discoveredUrls = new Set<string>()
    pages.forEach(page => {
      discoveredUrls.add(page.url)
      page.links?.forEach(link => discoveredUrls.add(link))
    })

    Logger.info(`[Firecrawl] Crawled ${pages.length} pages, discovered ${discoveredUrls.size} total URLs`)

    return {
      pages,
      discoveredUrls: Array.from(discoveredUrls),
      pagesFound: discoveredUrls.size
    }
  } catch (error) {
    Logger.error('[Firecrawl] Extraction failed', error instanceof Error ? error : undefined)
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
