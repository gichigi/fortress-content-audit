/**
 * HTTP-based link crawler
 * Actually fetches URLs to check if they're broken (vs Map-based inference)
 *
 * Architecture:
 * 1. Extract links from scraped pages
 * 2. HTTP check each link (with concurrency control)
 * 3. Report broken links, redirects, timeouts, etc.
 */

import type { FirecrawlPage } from './firecrawl-client'
import { scrapePage } from './firecrawl-client'
import Logger from './logger'

export interface CrawlerIssue {
  page_url: string // Source page where link appears
  category: 'Links & Formatting'
  issue_description: string
  severity: 'low' | 'medium' | 'critical'
  suggested_fix: string
}

interface LinkCheckResult {
  url: string
  sourceUrl: string
  linkText: string
  status: 'ok' | 'broken' | 'redirect_chain' | 'slow' | 'timeout' | 'error'
  httpStatus?: number
  redirectCount?: number
  responseTimeMs?: number
  finalUrl?: string
  error?: string
}

interface ExtractedLink {
  text: string
  href: string
  sourceUrl: string
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private current = 0
  private queue: (() => void)[] = []

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++
      return
    }

    return new Promise(resolve => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    this.current--
    const next = this.queue.shift()
    if (next) {
      this.current++
      next()
    }
  }
}

/**
 * Extract links from markdown content
 */
function extractLinksFromMarkdown(
  markdown: string,
  sourceUrl: string
): ExtractedLink[] {
  const links: ExtractedLink[] = []

  // Match markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match

  while ((match = linkRegex.exec(markdown)) !== null) {
    const text = match[1]
    const href = match[2]

    // Skip anchors, mailto, tel, javascript
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      continue
    }

    links.push({ text, href, sourceUrl })
  }

  return links
}

/**
 * Normalize URL for absolute path
 */
function normalizeUrl(url: string, baseUrl: string): string {
  try {
    // Handle relative URLs
    if (url.startsWith('/') && !url.startsWith('//')) {
      const base = new URL(baseUrl)
      return `${base.origin}${url}`
    }

    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      const base = new URL(baseUrl)
      return `${base.protocol}${url}`
    }

    // Handle absolute URLs
    if (url.startsWith('http')) {
      return url
    }

    // Relative path
    const base = new URL(baseUrl)
    return new URL(url, base.href).href
  } catch {
    return url
  }
}

/**
 * Check if URL is internal (same domain)
 */
function isInternalUrl(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url)
    const domainParsed = new URL(domain.startsWith('http') ? domain : `https://${domain}`)

    return parsed.hostname === domainParsed.hostname
  } catch {
    return false
  }
}

/**
 * Check a single link using HEAD request (fast, free)
 * For internal links without bot protection
 */
async function checkLinkWithFetch(
  url: string,
  sourceUrl: string,
  linkText: string,
  timeoutMs: number = 10000
): Promise<LinkCheckResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    })

    clearTimeout(timeout)
    const responseTimeMs = Date.now() - startTime
    const statusCode = response.status

    // 404 = Broken
    if (statusCode === 404) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'broken',
        httpStatus: 404,
        responseTimeMs
      }
    }

    // 5xx = Server error (broken)
    if (statusCode >= 500) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'broken',
        httpStatus: statusCode,
        responseTimeMs
      }
    }

    // 4xx (other than 404) = Client error
    if (statusCode >= 400) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'error',
        httpStatus: statusCode,
        responseTimeMs
      }
    }

    // 2xx/3xx = Success (fetch follows redirects automatically)
    // Check if slow (>3 seconds)
    if (responseTimeMs > 3000) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'slow',
        httpStatus: statusCode,
        responseTimeMs
      }
    }

    return {
      url,
      sourceUrl,
      linkText,
      status: 'ok',
      httpStatus: statusCode,
      responseTimeMs
    }

  } catch (error) {
    const responseTimeMs = Date.now() - startTime

    return {
      url,
      sourceUrl,
      linkText,
      status: 'error',
      responseTimeMs,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Check a single link using Firecrawl (bypasses bot protection)
 * For external links that may have bot protection
 */
async function checkLinkWithFirecrawl(
  url: string,
  sourceUrl: string,
  linkText: string,
  timeoutMs: number = 10000
): Promise<LinkCheckResult> {
  const startTime = Date.now()

  try {
    // Use Firecrawl to check the URL (handles redirects, bot protection, JS rendering)
    const result = await scrapePage(url)
    const responseTimeMs = Date.now() - startTime

    const statusCode = result.metadata?.statusCode

    // No status code means Firecrawl couldn't access it
    if (!statusCode) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'error',
        responseTimeMs,
        error: 'Could not determine status code'
      }
    }

    // 404 = Broken
    if (statusCode === 404) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'broken',
        httpStatus: 404,
        responseTimeMs
      }
    }

    // 5xx = Server error (broken)
    if (statusCode >= 500) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'broken',
        httpStatus: statusCode,
        responseTimeMs
      }
    }

    // 4xx (other than 404) = Client error
    if (statusCode >= 400) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'error',
        httpStatus: statusCode,
        responseTimeMs
      }
    }

    // 3xx = Redirects (Firecrawl follows them automatically, so if we got here, it worked)
    // 2xx = Success
    // Both are OK!

    // Check if slow (>3 seconds)
    if (responseTimeMs > 3000) {
      return {
        url,
        sourceUrl,
        linkText,
        status: 'slow',
        httpStatus: statusCode,
        responseTimeMs
      }
    }

    return {
      url,
      sourceUrl,
      linkText,
      status: 'ok',
      httpStatus: statusCode,
      responseTimeMs
    }

  } catch (error) {
    const responseTimeMs = Date.now() - startTime

    return {
      url,
      sourceUrl,
      linkText,
      status: 'error',
      responseTimeMs,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Convert check results to issues
 */
function resultToIssue(result: LinkCheckResult): CrawlerIssue | null {
  const { status, url, sourceUrl, linkText, httpStatus, responseTimeMs } = result

  switch (status) {
    case 'ok':
      return null // No issue

    case 'broken':
      return {
        page_url: sourceUrl,
        category: 'Links & Formatting',
        severity: httpStatus === 404 ? 'critical' : 'medium',
        issue_description: `broken link: Link "${linkText}" points to ${url}, which returned HTTP ${httpStatus}.`,
        suggested_fix: httpStatus === 404
          ? 'Remove the broken link or update it to point to a valid page. The target page does not exist.'
          : `Server error (${httpStatus}). Check the target server or remove the link.`
      }

    case 'slow':
      return {
        page_url: sourceUrl,
        category: 'Links & Formatting',
        severity: 'low',
        issue_description: `performance: Link "${linkText}" to ${url} took ${responseTimeMs}ms to respond (>3 seconds).`,
        suggested_fix: 'Check if the target server is slow or consider removing the link if it consistently times out.'
      }

    case 'error':
      return {
        page_url: sourceUrl,
        category: 'Links & Formatting',
        severity: 'medium',
        issue_description: `error: Link "${linkText}" to ${url} returned error${httpStatus ? ` (HTTP ${httpStatus})` : ''}.`,
        suggested_fix: result.error || 'Check the link and verify it is accessible.'
      }

    default:
      return null
  }
}

/**
 * Crawl and validate links from scraped pages
 */
export async function crawlLinks(
  scrapedPages: FirecrawlPage[],
  domain: string,
  config?: {
    concurrency?: number
    timeoutMs?: number
    checkExternal?: boolean
    maxLinks?: number
  }
): Promise<CrawlerIssue[]> {
  const {
    concurrency = 5,
    timeoutMs = 10000,
    checkExternal = false,
    maxLinks = 200
  } = config || {}

  Logger.debug(`[LinkCrawler] Starting link validation for ${scrapedPages.length} pages`)
  Logger.debug(`[LinkCrawler] Config: concurrency=${concurrency}, timeout=${timeoutMs}ms, checkExternal=${checkExternal}, maxLinks=${maxLinks}`)

  // Extract all links from pages
  const allLinks: ExtractedLink[] = []
  for (const page of scrapedPages) {
    if (!page.markdown) continue
    const links = extractLinksFromMarkdown(page.markdown, page.url)
    allLinks.push(...links)
  }

  // Normalize and filter links
  const linksToCheck = allLinks
    .map(link => ({
      ...link,
      href: normalizeUrl(link.href, link.sourceUrl)
    }))
    .filter(link => {
      // Skip external links unless configured
      if (!checkExternal && !isInternalUrl(link.href, domain)) {
        return false
      }

      // Skip non-HTML files (images, videos, PDFs, etc.)
      // Firecrawl can't scrape these and they should be validated differently
      const assetExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.pdf', '.zip', '.mp4', '.mp3', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot']
      const url = link.href.toLowerCase()
      if (assetExtensions.some(ext => url.includes(ext))) {
        return false
      }

      return true
    })

  // Deduplicate by URL+source (same link on same page)
  const uniqueLinks = Array.from(
    new Map(
      linksToCheck.map(link => [`${link.href}||${link.sourceUrl}`, link])
    ).values()
  )

  // Limit total links to check
  const limitedLinks = uniqueLinks.slice(0, maxLinks)

  if (uniqueLinks.length > maxLinks) {
    Logger.info(`[LinkCrawler] Limited to ${maxLinks} links (${uniqueLinks.length} total found)`)
  }

  // Count internal vs external for logging
  const internalCount = limitedLinks.filter(link => isInternalUrl(link.href, domain)).length
  const externalCount = limitedLinks.length - internalCount

  Logger.info(`[LinkCrawler] Checking ${limitedLinks.length} links (${internalCount} internal via fetch, ${externalCount} external via Firecrawl)...`)

  // Check links with concurrency control
  // Use hybrid approach: Fetch for internal, Firecrawl for external (bypasses bot protection)
  const semaphore = new Semaphore(concurrency)
  const results: LinkCheckResult[] = []

  const checkPromises = limitedLinks.map(async (link) => {
    await semaphore.acquire()
    try {
      const isInternal = isInternalUrl(link.href, domain)

      // Internal links: use fast HEAD request
      // External links: use Firecrawl (bypasses LinkedIn, Capterra, etc. bot protection)
      const result = isInternal
        ? await checkLinkWithFetch(link.href, link.sourceUrl, link.text, timeoutMs)
        : await checkLinkWithFirecrawl(link.href, link.sourceUrl, link.text, timeoutMs)

      results.push(result)
    } catch (error) {
      Logger.warn(`[LinkCrawler] Unexpected error checking ${link.href}:`, error)
    } finally {
      semaphore.release()
    }
  })

  await Promise.all(checkPromises)

  // Convert results to issues
  const issues = results
    .map(result => resultToIssue(result))
    .filter((issue): issue is CrawlerIssue => issue !== null)

  // Log summary
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  Logger.info(
    `[LinkCrawler] Complete: ${results.length} links checked. ` +
    `${statusCounts.ok || 0} OK, ${statusCounts.broken || 0} broken, ` +
    `${statusCounts.timeout || 0} timeout, ${statusCounts.error || 0} errors. ` +
    `Found ${issues.length} issues.`
  )

  return issues
}
