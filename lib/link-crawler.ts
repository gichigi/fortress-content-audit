import { ElementManifest } from './manifest-extractor'

export interface LinkCheckResult {
  url: string
  sourceUrl: string
  linkText: string
  status: 'ok' | 'broken' | 'redirect_chain' | 'redirect_loop' | 'slow' | 'ssl_error' | 'timeout' | 'mixed_content'
  httpStatus?: number
  redirectCount?: number
  responseTimeMs?: number
  finalUrl?: string
  error?: string
}

export interface CrawlerIssue {
  page_url: string
  category: 'Links & Formatting'
  issue_description: string
  severity: 'low' | 'medium' | 'critical'
  suggested_fix: string
}

interface CrawlerConfig {
  concurrency?: number
  timeoutMs?: number
  checkExternal?: boolean
  maxLinks?: number
}

// Simple semaphore for concurrency control
class Semaphore {
  private permits: number
  private queue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return Promise.resolve()
    }
    return new Promise((resolve) => this.queue.push(resolve))
  }

  release(): void {
    this.permits++
    const next = this.queue.shift()
    if (next) {
      this.permits--
      next()
    }
  }
}

// Normalize URLs for deduplication
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove trailing slash, fragment
    let normalized = parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search
    return normalized
  } catch {
    return url
  }
}

// Extract all links from manifests
function extractLinks(manifests: ElementManifest[], baseUrl: string, checkExternal: boolean): Map<string, { sourceUrl: string; linkText: string }[]> {
  const linkMap = new Map<string, { sourceUrl: string; linkText: string }[]>()

  for (const manifest of manifests) {
    const sourceUrl = manifest.page_url

    // Extract from links array (manifest-extractor structure)
    if (manifest.links) {
      for (const link of manifest.links) {
        // Skip non-link types (mailto, tel)
        if (link.type === 'mailto' || link.type === 'tel') {
          continue
        }

        // Skip external links if not checking them
        if (!checkExternal && link.type === 'external') {
          continue
        }

        if (link.href && link.text) {
          const normalized = normalizeUrl(link.href)
          if (!linkMap.has(normalized)) {
            linkMap.set(normalized, [])
          }
          linkMap.get(normalized)!.push({ sourceUrl, linkText: link.text })
        }
      }
    }
  }

  return linkMap
}

function addLink(
  linkMap: Map<string, { sourceUrl: string; linkText: string }[]>,
  url: string,
  sourceUrl: string,
  linkText: string,
  baseUrl: string,
  checkExternal: boolean
) {
  try {
    // Skip non-http(s) protocols
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) {
      return
    }

    // Resolve relative URLs
    let absoluteUrl: string
    if (url.startsWith('http://') || url.startsWith('https://')) {
      absoluteUrl = url
    } else if (url.startsWith('//')) {
      absoluteUrl = 'https:' + url
    } else {
      absoluteUrl = new URL(url, baseUrl).href
    }

    // Skip external links if not checking them
    if (!checkExternal) {
      const urlHostname = new URL(absoluteUrl).hostname
      const baseHostname = new URL(baseUrl).hostname
      if (urlHostname !== baseHostname && !urlHostname.endsWith('.' + baseHostname)) {
        return
      }
    }

    const normalized = normalizeUrl(absoluteUrl)

    if (!linkMap.has(normalized)) {
      linkMap.set(normalized, [])
    }
    linkMap.get(normalized)!.push({ sourceUrl, linkText })
  } catch (error) {
    // Invalid URL, skip
    console.warn('Invalid URL:', url, error)
  }
}

// Check a single link
async function checkLink(
  url: string,
  sources: { sourceUrl: string; linkText: string }[],
  timeoutMs: number,
  baseUrl: string
): Promise<LinkCheckResult[]> {
  const startTime = Date.now()
  const results: LinkCheckResult[] = []
  const isHttps = baseUrl.startsWith('https://')

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const redirectChain: string[] = [url]
    let currentUrl = url
    let redirectCount = 0
    const maxRedirects = 10

    // Manual redirect following to track chain
    while (redirectCount < maxRedirects) {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Fortress-Content-Audit-Bot/1.0'
        }
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      // Check for mixed content
      const isMixedContent = isHttps && currentUrl.startsWith('http://')

      // Success
      if (response.status >= 200 && response.status < 300) {
        const status = isMixedContent ? 'mixed_content' : (responseTime > 3000 ? 'slow' : 'ok')
        const redirectChainIssue = redirectCount >= 3 ? 'redirect_chain' : null

        for (const source of sources) {
          // Report redirect chain issue if present
          if (redirectChainIssue) {
            results.push({
              url,
              sourceUrl: source.sourceUrl,
              linkText: source.linkText,
              status: 'redirect_chain',
              httpStatus: response.status,
              redirectCount,
              responseTimeMs: responseTime,
              finalUrl: currentUrl
            })
          } else if (status !== 'ok') {
            // Report mixed content or slow response
            results.push({
              url,
              sourceUrl: source.sourceUrl,
              linkText: source.linkText,
              status,
              httpStatus: response.status,
              redirectCount,
              responseTimeMs: responseTime,
              finalUrl: currentUrl
            })
          }
          // If everything is OK, we don't create a result (no issue)
        }

        return results
      }

      // Redirect
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) {
          throw new Error('Redirect without Location header')
        }

        // Resolve relative redirect URLs
        const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href

        // Check for redirect loop - use exact URL comparison (don't normalize)
        if (redirectChain.includes(nextUrl)) {
          for (const source of sources) {
            results.push({
              url,
              sourceUrl: source.sourceUrl,
              linkText: source.linkText,
              status: 'redirect_loop',
              httpStatus: response.status,
              redirectCount,
              responseTimeMs: responseTime,
              error: `Redirect loop detected: ${redirectChain.join(' → ')} → ${nextUrl}`
            })
          }
          return results
        }

        redirectChain.push(nextUrl)
        currentUrl = nextUrl
        redirectCount++
        continue
      }

      // Error status
      for (const source of sources) {
        results.push({
          url,
          sourceUrl: source.sourceUrl,
          linkText: source.linkText,
          status: 'broken',
          httpStatus: response.status,
          redirectCount,
          responseTimeMs: responseTime
        })
      }
      return results
    }

    // Max redirects exceeded
    for (const source of sources) {
      results.push({
        url,
        sourceUrl: source.sourceUrl,
        linkText: source.linkText,
        status: 'redirect_loop',
        redirectCount,
        responseTimeMs: Date.now() - startTime,
        error: 'Too many redirects'
      })
    }
    return results

  } catch (error: any) {
    const responseTime = Date.now() - startTime

    // Determine error type
    let status: LinkCheckResult['status'] = 'broken'
    let errorMsg = error.message || 'Unknown error'

    if (error.name === 'AbortError') {
      status = 'timeout'
      errorMsg = 'Request timeout'
    } else if (errorMsg.includes('SSL') || errorMsg.includes('certificate') || errorMsg.includes('TLS')) {
      status = 'ssl_error'
    }

    for (const source of sources) {
      results.push({
        url,
        sourceUrl: source.sourceUrl,
        linkText: source.linkText,
        status,
        responseTimeMs: responseTime,
        error: errorMsg
      })
    }
    return results
  }
}

// Convert check results to issues
function resultToIssue(result: LinkCheckResult): CrawlerIssue | null {
  // No issue for OK links
  if (result.status === 'ok') {
    return null
  }

  let severity: 'low' | 'medium' | 'critical' = 'low'
  let issueDescription = ''
  let suggestedFix = ''

  switch (result.status) {
    case 'broken':
      severity = 'critical'
      issueDescription = `frustration: Link "${result.linkText}" returns ${result.httpStatus || 'error'}.`
      suggestedFix = result.httpStatus === 404
        ? `Fix or remove the broken link to ${result.url}.`
        : `Check and fix the broken link to ${result.url}.`
      break

    case 'timeout':
      severity = 'critical'
      issueDescription = `frustration: Link "${result.linkText}" times out or is unreachable.`
      suggestedFix = `Check if the URL is correct: ${result.url}`
      break

    case 'redirect_loop':
      severity = 'critical'
      issueDescription = `frustration: Link "${result.linkText}" has a redirect loop.`
      suggestedFix = `Fix the redirect configuration for ${result.url}.`
      break

    case 'ssl_error':
      severity = 'medium'
      issueDescription = `trust: Link "${result.linkText}" has SSL certificate errors.`
      suggestedFix = `Fix the SSL certificate for ${result.url}.`
      break

    case 'redirect_chain':
      severity = 'low'
      issueDescription = `performance: Link "${result.linkText}" has ${result.redirectCount} redirects before reaching destination.`
      suggestedFix = `Update link directly to final URL: ${result.finalUrl || result.url}.`
      break

    case 'slow':
      severity = 'low'
      issueDescription = `performance: Link "${result.linkText}" takes ${Math.round(result.responseTimeMs! / 1000)}s to respond.`
      suggestedFix = `Check server performance for ${result.url}.`
      break

    case 'mixed_content':
      severity = 'low'
      issueDescription = `security: Link "${result.linkText}" uses HTTP on an HTTPS page.`
      suggestedFix = `Update link to HTTPS: ${result.url.replace('http://', 'https://')}.`
      break
  }

  return {
    page_url: result.sourceUrl,
    category: 'Links & Formatting',
    issue_description: issueDescription,
    severity,
    suggested_fix: suggestedFix
  }
}

// Main crawler function
export async function crawlLinks(
  manifests: ElementManifest[],
  baseUrl: string,
  config: CrawlerConfig = {}
): Promise<CrawlerIssue[]> {
  const {
    concurrency = 5,
    timeoutMs = 10000,
    checkExternal = true,
    maxLinks = 200
  } = config

  try {
    console.log(`[Link Crawler] Starting with concurrency=${concurrency}, timeout=${timeoutMs}ms, maxLinks=${maxLinks}`)

    // Extract all unique links
    const linkMap = extractLinks(manifests, baseUrl, checkExternal)
    console.log(`[Link Crawler] Found ${linkMap.size} unique links to check`)

    // Limit number of links if needed
    const linksToCheck = Array.from(linkMap.entries()).slice(0, maxLinks)

    // Check links with concurrency control
    const semaphore = new Semaphore(concurrency)
    const allResults: LinkCheckResult[] = []

    const checkPromises = linksToCheck.map(async ([url, sources]) => {
      await semaphore.acquire()
      try {
        const results = await checkLink(url, sources, timeoutMs, baseUrl)
        allResults.push(...results)
      } finally {
        semaphore.release()
      }
    })

    await Promise.all(checkPromises)

    // Convert results to issues
    const issues = allResults
      .map(resultToIssue)
      .filter((issue): issue is CrawlerIssue => issue !== null)

    console.log(`[Link Crawler] Completed: ${issues.length} issues found from ${linksToCheck.length} links`)
    return issues

  } catch (error) {
    console.error('[Link Crawler] Failed:', error)
    // Graceful degradation - return empty array if crawler fails
    return []
  }
}
