import Logger from "./logger"

export interface InputDetectionResult {
  isUrl: boolean
  cleanInput: string
  inputType: 'url' | 'description' | 'empty'
}

export interface InputValidationResult {
  isValid: boolean
  cleanInput: string
  inputType: 'url' | 'description' | 'empty'
  error?: string
}

/**
 * Detects whether input is a URL or description text
 * Handles whitespace trimming and basic URL pattern detection
 */
export function detectInputType(input: string): InputDetectionResult {
  // Trim whitespace from both ends
  const cleanInput = input.trim()
  
  if (!cleanInput) {
    return {
      isUrl: false,
      cleanInput,
      inputType: 'empty'
    }
  }

  // URL patterns to check for
  const urlPatterns = [
    /^https?:\/\//i,                    // Starts with http:// or https://
    /\.[a-z]{2,}([\/\?]|$)/i,          // Contains domain extension (.com, .org, etc.)
    /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/,    // Basic domain pattern (example.com)
    /^www\./i,                         // Starts with www.
    /^localhost$/i                     // localhost (treat as URL for proper validation)
  ]

  const isUrl = urlPatterns.some(pattern => pattern.test(cleanInput))
  
  Logger.debug("Input type detection", { 
    input, 
    cleanInput, 
    isUrl,
    inputType: isUrl ? 'url' : 'description'
  })

  return {
    isUrl,
    cleanInput,
    inputType: isUrl ? 'url' : 'description'
  }
}

/**
 * Validates input based on detected type
 * Returns validation result with clean input and error messages
 */
export function validateInput(input: string): InputValidationResult {
  const detection = detectInputType(input)
  
  // Handle empty input
  if (detection.inputType === 'empty') {
    return {
      isValid: true, // Empty is valid - user can go to manual entry
      cleanInput: detection.cleanInput,
      inputType: 'empty'
    }
  }

  // Validate URL
  if (detection.inputType === 'url') {
    try {
      // Add https:// if missing protocol
      let urlToCheck = detection.cleanInput
      if (!urlToCheck.match(/^https?:\/\//)) {
        urlToCheck = `https://${urlToCheck}`
      }

      // Try to create URL object
      const url = new URL(urlToCheck)

      // Basic validation checks
      if (!url.hostname) {
        throw new Error("Invalid URL format")
      }

      if (url.hostname === 'localhost') {
        throw new Error("localhost URLs not allowed")
      }

      // Must have at least one dot in hostname (except localhost)
      if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
        throw new Error("Invalid domain format")
      }

      // Check for invalid domain patterns
      if (url.hostname.includes('..') || url.hostname.startsWith('.') || url.hostname.endsWith('.')) {
        throw new Error("Invalid domain format")
      }

      Logger.info("URL validation successful", { url: url.toString() })
      
      return {
        isValid: true,
        cleanInput: url.toString(),
        inputType: 'url'
      }

    } catch (error) {
      Logger.error("URL validation failed", error instanceof Error ? error : new Error("Unknown error"))
      
      return {
        isValid: false,
        cleanInput: detection.cleanInput,
        inputType: 'url',
        error: "Enter a valid URL (e.g., example.com)"
      }
    }
  }

  // Validate description text
  if (detection.inputType === 'description') {
    // Check minimum length (approximately 5 words)
    if (detection.cleanInput.length < 25) {
      return {
        isValid: false,
        cleanInput: detection.cleanInput,
        inputType: 'description',
        error: "Write at least 25 characters about your brand"
      }
    }

    // Check maximum length (reasonable limit for brief description)
    if (detection.cleanInput.length > 200) {
      return {
        isValid: false,
        cleanInput: detection.cleanInput,
        inputType: 'description',
        error: "Description too long. Keep under 200 characters"
      }
    }

    Logger.info("Description validation successful", { 
      length: detection.cleanInput.length 
    })

    return {
      isValid: true,
      cleanInput: detection.cleanInput,
      inputType: 'description'
    }
  }

  // Fallback (shouldn't reach here)
  return {
    isValid: false,
    cleanInput: detection.cleanInput,
    inputType: 'description',
    error: "Invalid input format"
  }
}

/**
 * Prevents leading spaces in input fields
 * Use this in onChange handlers to block leading whitespace
 */
export function sanitizeInput(value: string, currentValue: string): string {
  // Don't allow leading spaces
  if (value.startsWith(' ') && currentValue === '') {
    return ''
  }
  
  // Allow typing normally after first character
  return value
} 