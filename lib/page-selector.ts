// Intelligent page selection using AI to pick the most valuable pages to audit.
// Extracted from audit.ts to break the circular dependency with firecrawl-adapter.ts.

import { createTracedOpenAIClient } from './langsmith-openai'
import Logger from './logger'

const LONGFORM_PATH_PATTERNS = [
  /\/blog(\/|$)/i,
  /\/articles?(\/|$)/i,
  /\/news(\/|$)/i,
  /\/insights(\/|$)/i,
  /\/resources(\/|$)/i,
  /\/guides?(\/|$)/i,
]

function isLongformUrl(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return LONGFORM_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname || '/'))
  } catch {
    return false
  }
}

/**
 * Use AI to pick the most valuable pages from a discovered URL list.
 * - FREE tier: 5 pages, PAID tier: 20 pages
 * - Always includes homepage
 * - Validates AI output against discovered URLs to prevent hallucination
 */
export async function selectPagesToAudit(
  discoveredUrls: string[],
  domain: string,
  tier: 'FREE' | 'PAID',
  includeLongformFullAudit: boolean
): Promise<string[]> {
  const targetCount = tier === 'FREE' ? 5 : 20

  // Always include homepage
  const homepage =
    discoveredUrls.find((u) => {
      try {
        const path = new URL(u).pathname
        return path === '/' || path === ''
      } catch {
        return false
      }
    }) || `https://${domain}`

  const candidateUrls = includeLongformFullAudit
    ? discoveredUrls
    : discoveredUrls.filter((u) => !isLongformUrl(u))
  const urlsForSelection = candidateUrls.length > 0 ? candidateUrls : discoveredUrls

  // If we have fewer URLs than the target, just use all of them
  if (urlsForSelection.length <= targetCount) {
    Logger.info(`[PageSelection] Using all ${urlsForSelection.length} discovered URLs (≤${targetCount} target)`)
    return urlsForSelection.length > 0 ? urlsForSelection : [homepage]
  }

  const openai = createTracedOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  })

  try {
    Logger.debug(`[PageSelection] Selecting ${targetCount} pages from ${urlsForSelection.length} discovered URLs`)

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: `Pick the ${targetCount} most important pages to audit for content quality from this website.

CRITICAL: You MUST ONLY select URLs from the "Available URLs" list below. Do NOT make up or guess URLs.

Prioritize in order:
1. Homepage (always include)
2. Pricing/plans page (if one exists in the list)
3. About/company page (if one exists in the list)
4. Key product/feature pages
5. Contact/support page (if one exists in the list)
6. ${includeLongformFullAudit ? 'Blog posts (1-2 max)' : 'Avoid blog/article/resource pages unless no other pages are available'}
7. Other high-value marketing pages

Return ONLY a JSON object with this exact format: {"urls": ["url1", "url2", ...]}
Do not include any explanation or other text.
Only include URLs that appear in the list below.

Available URLs:
${urlsForSelection.join('\n')}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      Logger.warn('[PageSelection] Empty response from model, falling back to first N URLs')
      return [homepage, ...urlsForSelection.filter((u) => u !== homepage).slice(0, targetCount - 1)]
    }

    const result = JSON.parse(content)
    const selectedUrls: string[] = result.urls || []

    if (selectedUrls.length === 0) {
      Logger.warn('[PageSelection] No URLs selected by model, falling back to first N URLs')
      return [homepage, ...discoveredUrls.filter((u) => u !== homepage).slice(0, targetCount - 1)]
    }

    // Validate against discovered URLs to prevent hallucination
    const normalize = (url: string) => {
      try {
        const parsed = new URL(url)
        return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '').toLowerCase()
      } catch {
        return url.replace(/\/$/, '').toLowerCase()
      }
    }

    const normalizedDiscovered = urlsForSelection.map(normalize)
    const validUrls: string[] = []
    const hallucinatedUrls: string[] = []

    for (const url of selectedUrls) {
      if (normalizedDiscovered.includes(normalize(url))) {
        validUrls.push(url)
      } else {
        hallucinatedUrls.push(url)
      }
    }

    if (hallucinatedUrls.length > 0) {
      Logger.warn(`[PageSelection] Model hallucinated ${hallucinatedUrls.length} URLs: ${hallucinatedUrls.join(', ')}`)
    }

    if (validUrls.length === 0) {
      Logger.warn('[PageSelection] All selected URLs were hallucinated, falling back to first N URLs')
      return [homepage, ...urlsForSelection.filter((u) => u !== homepage).slice(0, targetCount - 1)]
    }

    // Ensure homepage is in the final list
    if (!validUrls.includes(homepage)) {
      validUrls.unshift(homepage)
      if (validUrls.length > targetCount) validUrls.pop()
    }

    Logger.info(`[PageSelection] Selected ${validUrls.length} pages (filtered ${hallucinatedUrls.length} hallucinated)`)
    return validUrls
  } catch (error) {
    Logger.warn('[PageSelection] Error selecting pages, falling back to first N URLs', error instanceof Error ? error : undefined)
    return [homepage, ...urlsForSelection.filter((u) => u !== homepage).slice(0, targetCount - 1)]
  }
}
