import { OpenAI } from "openai"
import Logger from "./logger"

// Enhanced Error Handling for AI Style Guide API calls
// Phase 1: Error mapping and user-friendly messages

// Error types mapped to user-friendly messages
export const ERROR_MESSAGES = {
  // Website extraction errors
  INVALID_URL: "We couldn't access that website. Please check the URL and try again.",
  WEBSITE_BLOCKED: "This website blocks automated access. Try a different URL or enter your brand details manually.",
  WEBSITE_TIMEOUT: "The website took too long to respond. Please try again or enter details manually.",
  WEBSITE_NOT_FOUND: "We couldn't find that website. Please check the URL for typos.",
  
  // OpenAI API errors
  OPENAI_RATE_LIMIT: "Our AI service is busy right now. We'll try again in a moment.",
  OPENAI_TOKEN_LIMIT: "Your brand description is too long (over 500 characters). Please shorten it and try again.",
  OPENAI_API_KEY: "There's a configuration issue on our end. Please contact support.",
  OPENAI_CONNECTION: "We're having trouble connecting to our AI service. Please try again.",
  
  // Template processing errors
  TEMPLATE_NOT_FOUND: "We're missing some required files. Please contact support.",
  TEMPLATE_PROCESSING: "There was an issue generating your style guide. Please try again.",
  
  // Stripe/Payment errors
  PAYMENT_FAILED: "Payment could not be processed. Please check your payment details and try again.",
  PAYMENT_TIMEOUT: "Payment session expired. Please start the checkout process again.",
  
  // Network/General errors
  NETWORK_ERROR: "Connection issue. Please check your internet and try again.",
  SERVER_ERROR: "Something went wrong on our end. Please try again in a moment.",
  VALIDATION_ERROR: "Please check your input and try again.",
  
  // Generic fallback
  UNKNOWN_ERROR: "Something unexpected happened. Please try again or contact support if the issue persists.",
} as const

// Error classification function
export function classifyError(error: any): keyof typeof ERROR_MESSAGES {
  const errorMessage = error?.message?.toLowerCase() || error?.error?.toLowerCase() || String(error).toLowerCase()
  
  // Website extraction errors
  if (errorMessage.includes('invalid url') || errorMessage.includes('malformed')) {
    return 'INVALID_URL'
  }
  if (errorMessage.includes('blocked') || errorMessage.includes('forbidden') || errorMessage.includes('403')) {
    return 'WEBSITE_BLOCKED'
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'WEBSITE_TIMEOUT'
  }
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return 'WEBSITE_NOT_FOUND'
  }
  
  // OpenAI errors
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || errorMessage.includes('429')) {
    return 'OPENAI_RATE_LIMIT'
  }
  if (errorMessage.includes('token') || errorMessage.includes('too long') || errorMessage.includes('context length')) {
    return 'OPENAI_TOKEN_LIMIT'
  }
  if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
    return 'OPENAI_API_KEY'
  }
  if (errorMessage.includes('openai') && (errorMessage.includes('connection') || errorMessage.includes('network'))) {
    return 'OPENAI_CONNECTION'
  }
  
  // Template errors
  if (errorMessage.includes('template not found') || errorMessage.includes('template_not_found')) {
    return 'TEMPLATE_NOT_FOUND'
  }
  if (errorMessage.includes('template') || errorMessage.includes('processing')) {
    return 'TEMPLATE_PROCESSING'
  }
  
  // Payment errors
  if (errorMessage.includes('payment') || errorMessage.includes('stripe') || errorMessage.includes('checkout')) {
    if (errorMessage.includes('expired') || errorMessage.includes('timeout')) {
      return 'PAYMENT_TIMEOUT'
    }
    return 'PAYMENT_FAILED'
  }
  
  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return 'NETWORK_ERROR'
  }
  
  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('internal server')) {
    return 'SERVER_ERROR'
  }
  
  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('required') || errorMessage.includes('invalid')) {
    return 'VALIDATION_ERROR'
  }
  
  return 'UNKNOWN_ERROR'
}

// Get user-friendly error message
export function getUserFriendlyError(error: any): string {
  const errorType = classifyError(error)
  return ERROR_MESSAGES[errorType]
}

// Enhanced error response interface
export interface ErrorDetails {
  message: string
  type: keyof typeof ERROR_MESSAGES
  canRetry: boolean
  suggestedAction?: string
  originalError?: string
  supportEmailLink?: string
}

// Create support email link with pre-filled subject and body
function createSupportEmailLink(errorType: keyof typeof ERROR_MESSAGES, additionalInfo?: string): string {
  const subject = encodeURIComponent("Style Guide Generation Issue")
  const body = encodeURIComponent(`Hi AIStyleGuide Support Team,

I'm having trouble generating my style guide. Here are the details:

Error: ${errorType}
Time: ${new Date().toLocaleString()}${additionalInfo ? `
Additional Info: ${additionalInfo}` : ''}

Please help me resolve this issue.

Thanks!`)
  
  return `mailto:support@aistyleguide.com?subject=${subject}&body=${body}`
}

// Create detailed error response
export function createErrorDetails(error: any): ErrorDetails {
  const errorType = classifyError(error)
  const message = ERROR_MESSAGES[errorType]
  
  // Determine if error is retryable
  const retryableErrors: Array<keyof typeof ERROR_MESSAGES> = [
    'OPENAI_RATE_LIMIT',
    'WEBSITE_TIMEOUT', 
    'OPENAI_CONNECTION',
    'NETWORK_ERROR',
    'SERVER_ERROR'
  ]
  
  const canRetry = retryableErrors.includes(errorType)
  
  // Suggest specific actions based on error type
  let suggestedAction: string | undefined
  
  switch (errorType) {
    case 'INVALID_URL':
      suggestedAction = "Check for typos in the URL or try adding 'https://' at the beginning"
      break
    case 'WEBSITE_BLOCKED':
      suggestedAction = "Try entering your brand details manually instead"
      break
    case 'OPENAI_TOKEN_LIMIT':
      suggestedAction = "Shorten your brand description to under 500 characters (about 100 words)"
      break
    case 'PAYMENT_TIMEOUT':
      suggestedAction = "Start a new checkout session from the preview page"
      break
    case 'TEMPLATE_NOT_FOUND':
      suggestedAction = "Contact support with error code: TEMPLATE_MISSING"
      break
  }
  
  // Create support email link
  const supportEmailLink = createSupportEmailLink(errorType, error?.message)
  
  return {
    message,
    type: errorType,
    canRetry,
    suggestedAction,
    supportEmailLink,
    originalError: error?.message || String(error)
  }
}

// Retry configuration
interface RetryConfig {
  maxAttempts: number
  delayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000, // Start with 1 second
  backoffMultiplier: 2 // Double delay each retry
}

// Enhanced fetch with retry logic
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  let lastError: any
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(300000) // 5 minute timeout for style guide generation
      })
      
      // If response is ok, return it
      if (response.ok) {
        return response
      }
      
      // For client errors (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // For server errors (5xx), retry
      if (attempt === config.maxAttempts) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
    } catch (error) {
      lastError = error
      
      // Don't retry on client errors or non-retryable errors
      const errorDetails = createErrorDetails(error)
      if (!errorDetails.canRetry || attempt === config.maxAttempts) {
        throw error
      }
      
      // Wait before retrying with exponential backoff
      const delay = config.delayMs * Math.pow(config.backoffMultiplier, attempt - 1)
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

// Simplified API call wrapper
export async function callAPI(endpoint: string, data?: any, retryConfig?: Partial<RetryConfig>) {
  try {
    const response = await fetchWithRetry(endpoint, {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    }, retryConfig)
    
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || result.message || 'API call failed')
    }
    
    return result
  } catch (error) {
    // Re-throw with enhanced error details
    const errorDetails = createErrorDetails(error)
    const enhancedError = new Error(errorDetails.message)
    ;(enhancedError as any).details = errorDetails
    throw enhancedError
  }
} 