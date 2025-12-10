// fortress v1
/**
 * Detect locale from a website URL
 * Returns BCP-47 language tag (e.g., 'en-US', 'en-GB', 'es-ES')
 * Falls back to 'en-US' if detection fails
 */
export async function detectLocaleFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FortressBot/1.0)',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    })

    if (!response.ok) {
      return 'en-US' // Default fallback
    }

    const html = await response.text()
    
    // Try to extract from <html lang="...">
    const htmlLangMatch = html.match(/<html[^>]*\s+lang=["']([^"']+)["']/i)
    if (htmlLangMatch && htmlLangMatch[1]) {
      return normalizeLanguageTag(htmlLangMatch[1])
    }

    // Try to extract from <meta http-equiv="content-language">
    const metaLangMatch = html.match(/<meta[^>]*http-equiv=["']content-language["'][^>]*content=["']([^"']+)["']/i)
    if (metaLangMatch && metaLangMatch[1]) {
      return normalizeLanguageTag(metaLangMatch[1])
    }

    // Try to extract from <meta property="og:locale">
    const ogLocaleMatch = html.match(/<meta[^>]*property=["']og:locale["'][^>]*content=["']([^"']+)["']/i)
    if (ogLocaleMatch && ogLocaleMatch[1]) {
      return normalizeLanguageTag(ogLocaleMatch[1])
    }

    return 'en-US' // Default fallback
  } catch (error) {
    console.error('Locale detection failed:', error)
    return 'en-US' // Default fallback
  }
}

/**
 * Normalize language tag to BCP-47 format
 * Examples: 'en' -> 'en-US', 'en-GB' -> 'en-GB', 'en_US' -> 'en-US'
 */
function normalizeLanguageTag(tag: string): string {
  // Replace underscores with hyphens
  let normalized = tag.replace(/_/g, '-').toLowerCase()
  
  // If it's just a language code (e.g., 'en'), default to 'en-US'
  if (normalized.length === 2 && !normalized.includes('-')) {
    if (normalized === 'en') {
      return 'en-US' // Default English to US
    }
    return normalized
  }

  // If it's a language-region pair, ensure proper format
  const parts = normalized.split('-')
  if (parts.length >= 2) {
    // Take first two parts (language-region)
    return `${parts[0]}-${parts[1].toUpperCase()}`
  }

  return normalized
}


