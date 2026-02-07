/**
 * Element Manifest Extractor
 * Extracts HTML element structure from pages to prevent false positives
 * Uses fetch + cheerio (no browser required)
 */

import * as cheerio from 'cheerio'
import Logger from './logger'

export interface ElementManifest {
  page_url: string
  links: Array<{
    text: string
    href: string
    location: string
    type: 'link' | 'mailto' | 'tel' | 'external'
  }>
  headings: Array<{
    tag: string
    text: string
    visible: boolean
  }>
  forms: Array<{
    action: string
    method: string
    inputs: number
  }>
  buttons: Array<{
    text: string
    type: string
  }>
  // Key copy samples for brand voice understanding
  descriptions: Array<{
    text: string
    source: 'meta' | 'hero' | 'paragraph'
  }>
}

/**
 * Detect if HTML contains common error patterns from CSR/SPA pages
 * Returns true if page appears to be in an error state
 */
function isErrorPage(htmlContent: string): boolean {
  const errorPatterns = [
    /internal error/i,
    /failed to fetch/i,
    /unexpectedstatuscode/i,
    /application error/i,
    /something went wrong/i,
    /page not found/i,
    /404.*not found/i,
    /500.*internal server/i,
    /503.*service unavailable/i,
    /this page (isn't|is not) working/i,
    /cannot get \//i,
    /error: /i,
    /uncaught exception/i
  ]

  const bodyText = htmlContent.substring(0, 5000) // Check first 5KB only (performance)
  return errorPatterns.some(pattern => pattern.test(bodyText))
}

/**
 * Extract element manifest from HTML content
 * For error pages: extracts links only (for page discovery) but skips content
 */
function extractPageManifestFromHtml(htmlContent: string, url: string, baseUrl: string): ElementManifest {
  const $ = cheerio.load(htmlContent)
  const isError = isErrorPage(htmlContent)

  // For error pages: extract links only (for page discovery) but skip content
  // This ensures page discovery works even if homepage has CSR error states
  if (isError) {
    Logger.debug(`[Manifest] Detected error page content at ${url} - extracting links only`)
  }

  const manifest: ElementManifest = {
    page_url: url,
    links: [],
    headings: [],
    forms: [],
    buttons: [],
    descriptions: []
  }

  // Extract links
  $('a').each((_i, el) => {
    const $el = $(el)
    const text = $el.text().trim() || $el.attr('aria-label') || '[no text]'
    const href = $el.attr('href') || ''

    if (!href) return

    let fullHref = href
    try {
      if (href.startsWith('/')) {
        fullHref = new URL(href, baseUrl).href
      } else if (!href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('tel')) {
        fullHref = new URL(href, baseUrl).href
      }
    } catch {
      // Invalid URL, keep original
    }

    const location = $el.closest('footer').length ? 'footer' :
                    $el.closest('header').length ? 'header' :
                    $el.closest('nav').length ? 'navigation' :
                    $el.closest('main').length ? 'main' : 'body'

    const baseHostname = new URL(baseUrl).hostname
    const type: 'link' | 'mailto' | 'tel' | 'external' =
      fullHref.startsWith('mailto:') ? 'mailto' :
      fullHref.startsWith('tel:') ? 'tel' :
      fullHref.startsWith('http') && !fullHref.includes(baseHostname) ? 'external' :
      'link'

    manifest.links.push({ text, href: fullHref, location, type })
  })

  // Skip content extraction for error pages (only extract links for page discovery)
  if (!isError) {
    // Extract headings
    $('h1, h2, h3, h4, h5, h6').each((_i, el) => {
      const $el = $(el)
      manifest.headings.push({
        tag: el.tagName.toLowerCase(),
        text: $el.text().trim(),
        visible: true // Cheerio can't detect visibility, assume visible
      })
    })

    // Extract forms
    $('form').each((_i, el) => {
      const $el = $(el)
      manifest.forms.push({
        action: $el.attr('action') || '[no action]',
        method: $el.attr('method') || 'get',
        inputs: $el.find('input, textarea, select').length
      })
    })

    // Extract buttons
    $('button').each((_i, el) => {
      const $el = $(el)
      manifest.buttons.push({
        text: $el.text().trim() || $el.attr('aria-label') || '[no text]',
        type: $el.attr('type') || 'button'
      })
    })

    // Extract key copy for brand voice (limited to avoid bloat)
    // 1. Meta description - often carefully crafted brand copy
    const metaDesc = $('meta[name="description"]').attr('content')?.trim()
    if (metaDesc && metaDesc.length > 20) {
      manifest.descriptions.push({ text: metaDesc, source: 'meta' })
    }

    // 2. Hero section copy (first substantial paragraph in main/header area)
    const heroSelectors = ['[class*="hero"] p', 'header p', 'main > section:first-child p', '[class*="banner"] p']
    for (const selector of heroSelectors) {
      $(selector).slice(0, 2).each((_i, el) => {
        const text = $(el).text().trim()
        if (text.length > 40 && text.length < 500 && manifest.descriptions.length < 5) {
          manifest.descriptions.push({ text, source: 'hero' })
        }
      })
    }

    // 3. Key paragraphs from main content (limited to 3, substantial text only)
    $('main p, article p, [class*="feature"] p, [class*="content"] p').slice(0, 10).each((_i, el) => {
      const text = $(el).text().trim()
      // Only include meaningful paragraphs (40-400 chars), skip tiny or huge blocks
      if (text.length > 40 && text.length < 400 && manifest.descriptions.length < 6) {
      // Avoid duplicates
      const isDuplicate = manifest.descriptions.some(d => d.text === text)
      if (!isDuplicate) {
        manifest.descriptions.push({ text, source: 'paragraph' })
      }
    }
  })
  } // End of !isError block

  return manifest
}

/**
 * Fetch HTML from a URL with proper headers
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FortressBot/1.0; +https://aistyleguide.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000), // 15s timeout
    })

    if (!response.ok) {
      Logger.debug(`[Manifest] HTTP ${response.status} for ${url}`)
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      Logger.debug(`[Manifest] Non-HTML content type for ${url}: ${contentType}`)
      return null
    }

    return await response.text()
  } catch (error) {
    Logger.debug(`[Manifest] Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return null
  }
}

/**
 * Extract element manifests from homepage and one additional page
 */
export async function extractElementManifest(url: string): Promise<ElementManifest[]> {
  const manifests: ElementManifest[] = []

  try {
    // Extract homepage manifest
    Logger.debug(`[Manifest] Fetching ${url}`)
    const homepageHtml = await fetchHtml(url)

    if (homepageHtml) {
      const homepageManifest = extractPageManifestFromHtml(homepageHtml, url, url)
      manifests.push(homepageManifest)
      if (homepageManifest.descriptions.length === 0) {
        Logger.debug(`[Manifest] Homepage: ${homepageManifest.links.length} links only (error page detected)`)
      } else {
        Logger.debug(`[Manifest] Homepage: ${homepageManifest.links.length} links, ${homepageManifest.headings.length} headings`)
      }
    } else {
      Logger.warn(`[Manifest] Could not fetch homepage ${url}`)
      return []
    }

    // Try to extract manifest from FAQ or About page
    const faqUrl = `${url}/faq`
    Logger.debug(`[Manifest] Fetching ${faqUrl}`)
    const faqHtml = await fetchHtml(faqUrl)

    if (faqHtml) {
      const faqManifest = extractPageManifestFromHtml(faqHtml, faqUrl, url)
      manifests.push(faqManifest)
      if (faqManifest.descriptions.length === 0 && faqManifest.headings.length === 0) {
        Logger.debug(`[Manifest] FAQ page: ${faqManifest.links.length} links only (error page detected)`)
      } else {
        Logger.debug(`[Manifest] FAQ page: ${faqManifest.links.length} links, ${faqManifest.headings.length} headings`)
      }
    } else {
      Logger.debug(`[Manifest] Could not load FAQ page, skipping`)
    }

    return manifests

  } catch (error) {
    Logger.error('[Manifest] Error extracting manifest', error instanceof Error ? error : undefined)
    // Return empty array on error - audit can still proceed without manifest
    return []
  }
}

/**
 * Format manifest for inclusion in prompt
 */
export function formatManifestForPrompt(manifests: ElementManifest[]): string {
  if (manifests.length === 0) {
    return '# ELEMENT MANIFEST\n\nNo manifest available (extraction failed or disabled).\n'
  }

  let output = '# ELEMENT MANIFEST (extracted from actual HTML)\n\n'

  for (const manifest of manifests) {
    output += `## ${manifest.page_url}\n\n`

    output += `### Links (${manifest.links.length} total)\n`
    manifest.links.forEach(link => {
      output += `- "${link.text}" → ${link.href} (${link.type}, ${link.location})\n`
    })

    output += `\n### Headings (${manifest.headings.length} visible)\n`
    manifest.headings.forEach(h => {
      output += `- <${h.tag}> ${h.text}\n`
    })

    if (manifest.forms.length > 0) {
      output += `\n### Forms (${manifest.forms.length})\n`
      manifest.forms.forEach(f => {
        output += `- Action: ${f.action}, Method: ${f.method}, Inputs: ${f.inputs}\n`
      })
    }

    if (manifest.buttons.length > 0) {
      output += `\n### Buttons (${manifest.buttons.length})\n`
      manifest.buttons.forEach(b => {
        output += `- "${b.text}" (${b.type})\n`
      })
    }

    output += '\n'
  }

  return output
}

/**
 * Count unique internal pages from manifests
 * Includes the manifested pages themselves + all internal links
 */
export function countInternalPages(manifests: ElementManifest[]): number {
  const uniquePages = new Set<string>()

  for (const manifest of manifests) {
    // Add the page itself
    uniquePages.add(normalizeUrl(manifest.page_url))

    // Add all internal links (type: 'link' = internal, type: 'external' = external)
    for (const link of manifest.links) {
      if (link.type === 'link') {
        uniquePages.add(normalizeUrl(link.href))
      }
    }
  }

  return uniquePages.size
}

/**
 * Extract list of discovered pages from manifests
 * Returns sorted array of unique normalized URLs
 */
export function extractDiscoveredPagesList(manifests: ElementManifest[]): string[] {
  const uniquePages = new Set<string>()

  for (const manifest of manifests) {
    // Add the page itself
    uniquePages.add(normalizeUrl(manifest.page_url))

    // Add all internal links (type: 'link' = internal)
    for (const link of manifest.links) {
      if (link.type === 'link') {
        uniquePages.add(normalizeUrl(link.href))
      }
    }
  }

  return Array.from(uniquePages).sort()
}

/**
 * Normalize URL for deduplication
 * Removes trailing slashes, hashes, query params
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove trailing slash, hash, query params
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}
