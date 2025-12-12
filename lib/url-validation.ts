import Logger from "./logger"

export interface UrlValidationResult {
  isValid: boolean
  url: string
  error?: string
}

export function validateUrl(input: string): UrlValidationResult {
  Logger.debug("Validating URL", { input })

  try {
    // Add https if no protocol specified
    let urlString = input
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString
      Logger.debug("Added https protocol", { urlString })
    }

    // Try to construct URL object
    const url = new URL(urlString)

    // Basic validation checks
    if (!url.hostname) {
      throw new Error("Missing hostname")
    }

    // Check for common issues
    if (url.hostname === 'localhost') {
      throw new Error("localhost URLs not allowed")
    }

    Logger.info("URL validation successful", { url: url.toString() })
    return {
      isValid: true,
      url: url.toString()
    }

  } catch (error) {
    Logger.error(
      "URL validation failed",
      error instanceof Error ? error : new Error("Unknown error"),
      { input }
    )
    return {
      isValid: false,
      url: input,
      error: error instanceof Error ? error.message : "Invalid URL format"
    }
  }
} 