/**
 * Error classification utility for audit failures
 * Categorizes error messages into specific types with actionable context
 */

export type AuditErrorType =
  | 'bot_protection'
  | 'timeout'
  | 'api_error'
  | 'network_error'
  | 'validation'
  | 'rate_limit';

export interface ClassifiedError {
  type: AuditErrorType;
  message: string;
  details: string;
  pagesAudited?: number;
}

/**
 * Classifies an error message into a specific error type
 * Returns structured error information for modal display
 */
export function classifyError(
  errorMessage: string,
  additionalContext?: { pagesAudited?: number }
): ClassifiedError {
  const lowerError = errorMessage.toLowerCase();

  // Rate limit detection
  if (
    lowerError.includes('rate limit') ||
    lowerError.includes('daily limit') ||
    lowerError.includes('429') ||
    lowerError.includes('reached your')
  ) {
    return {
      type: 'rate_limit',
      message: 'Daily audit limit reached',
      details: errorMessage,
    };
  }

  // Bot protection / firewall detection
  if (
    lowerError.includes('bot protection') ||
    lowerError.includes('firewall') ||
    lowerError.includes('cloudflare') ||
    lowerError.includes('recaptcha') ||
    lowerError.includes('captcha') ||
    lowerError.includes('blocked') ||
    lowerError.includes('forbidden')
  ) {
    return {
      type: 'bot_protection',
      message: 'Website has bot protection enabled',
      details: errorMessage,
    };
  }

  // Timeout detection
  if (
    lowerError.includes('timed out') ||
    lowerError.includes('timeout') ||
    lowerError.includes('time limit') ||
    lowerError.includes('exceeded')
  ) {
    return {
      type: 'timeout',
      message: 'Audit took longer than expected',
      details: errorMessage,
      pagesAudited: additionalContext?.pagesAudited || 0,
    };
  }

  // Network/connection errors
  if (
    lowerError.includes('connection') ||
    lowerError.includes('network') ||
    lowerError.includes('unreachable') ||
    lowerError.includes('offline') ||
    lowerError.includes('lost connection')
  ) {
    return {
      type: 'network_error',
      message: 'Lost connection during audit',
      details: errorMessage,
    };
  }

  // Validation errors
  if (
    lowerError.includes('invalid') ||
    lowerError.includes('validation') ||
    lowerError.includes('bad request') ||
    lowerError.includes('malformed')
  ) {
    return {
      type: 'validation',
      message: 'Invalid request',
      details: errorMessage,
    };
  }

  // Generic API error (fallback)
  return {
    type: 'api_error',
    message: errorMessage || 'An unexpected error occurred',
    details: '',
  };
}

/**
 * Helper to extract page count from error messages
 * Used for timeout errors to show partial progress
 */
export function extractPagesAudited(errorMessage: string): number | undefined {
  const match = errorMessage.match(/(\d+)\s+pages?/i);
  return match ? parseInt(match[1], 10) : undefined;
}
