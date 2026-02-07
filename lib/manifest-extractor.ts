/**
 * Element Manifest Extractor
 * Extracts HTML element structure from pages to prevent false positives
 */

import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import * as cheerio from 'cheerio'
import Logger from './logger'

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.VERCEL

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
 * Extract element manifest from a single page
 */
async function extractPageManifest(page: any, url: string, baseUrl: string): Promise<ElementManifest> {
  const htmlContent = await page.content()
  const $ = cheerio.load(htmlContent)

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

  return manifest
}

/**
 * Extract element manifests from homepage and one additional page
 */
export async function extractElementManifest(url: string): Promise<ElementManifest[]> {
  const manifests: ElementManifest[] = []

  let browser
  try {
    // Use @sparticuz/chromium for serverless, local Chrome otherwise
    let launchOptions
    if (isServerless) {
      // Disable GPU mode to avoid requiring system graphics libraries (libnss3.so etc)
      chromium.setGraphicsMode = false
      launchOptions = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      }
    } else {
      launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // Use local Chrome - puppeteer-core needs explicit path or channel
        channel: 'chrome',
      }
    }

    browser = await puppeteer.launch(launchOptions)

    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    // Extract homepage manifest
    Logger.debug(`[Manifest] Loading ${url}`)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    const homepageManifest = await extractPageManifest(page, url, url)
    manifests.push(homepageManifest)
    Logger.debug(`[Manifest] Homepage: ${homepageManifest.links.length} links, ${homepageManifest.headings.length} headings`)

    // Try to extract manifest from FAQ or About page
    const faqUrl = `${url}/faq`
    try {
      Logger.debug(`[Manifest] Loading ${faqUrl}`)
      await page.goto(faqUrl, { waitUntil: 'networkidle2', timeout: 15000 })

      const faqManifest = await extractPageManifest(page, faqUrl, url)
      manifests.push(faqManifest)
      Logger.debug(`[Manifest] FAQ page: ${faqManifest.links.length} links, ${faqManifest.headings.length} headings`)
    } catch (err) {
      Logger.debug(`[Manifest] Could not load FAQ page, skipping`)
    }

    return manifests

  } catch (error) {
    Logger.error('[Manifest] Error extracting manifest', error instanceof Error ? error : undefined)
    // Return empty array on error - audit can still proceed without manifest
    return []
  } finally {
    if (browser) {
      await browser.close()
    }
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
