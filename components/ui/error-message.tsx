import React from 'react'
import { Button } from './button'
import { Alert, AlertDescription } from './alert'
import { AlertTriangle, RefreshCw, Mail } from 'lucide-react'
import { ErrorDetails } from '@/lib/api-utils'

interface ErrorMessageProps {
  error: ErrorDetails
  onRetry?: () => void
  onDismiss?: () => void
  isRetrying?: boolean
  showRetryButton?: boolean
}

export function ErrorMessage({ 
  error, 
  onRetry, 
  onDismiss, 
  isRetrying = false,
  showRetryButton = true 
}: ErrorMessageProps) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <p className="font-medium">{error.message}</p>
        
        {error.suggestedAction && (
          <p className="text-sm text-muted-foreground">
            💡 {error.suggestedAction}
          </p>
        )}
        
        <div className="flex flex-col sm:flex-row gap-2">
          {showRetryButton && error.canRetry && onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Try Again
            </Button>
          )}
          
          {error.supportEmailLink && (
            <Button
              onClick={() => window.open(error.supportEmailLink, '_blank')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Mail className="h-3 w-3" />
              Contact Support
            </Button>
          )}
          
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="ghost"
              size="sm"
            >
              Dismiss
            </Button>
          )}
        </div>
        
        {process.env.NODE_ENV === 'development' && error.originalError && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Technical details (dev only)
            </summary>
            <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
              {error.originalError}
            </pre>
          </details>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Full-page error component for critical failures
export function PageError({ 
  error, 
  onRetry,
  isRetrying = false 
}: { 
  error: ErrorDetails
  onRetry?: () => void
  isRetrying?: boolean
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-gray-950 rounded-lg shadow-sm">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Something went wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {error.message}
          </p>
          
          {error.suggestedAction && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 {error.suggestedAction}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3">
          {error.canRetry && onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full gap-2"
            >
              {isRetrying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Try Again
            </Button>
          )}
          
          {error.supportEmailLink && (
            <Button
              onClick={() => window.open(error.supportEmailLink, '_blank')}
              variant="outline"
              className="w-full gap-2"
            >
              <Mail className="h-4 w-4" />
              Contact Support
            </Button>
          )}
        </div>
        
        {process.env.NODE_ENV === 'development' && error.originalError && (
          <details className="mt-4">
            <summary className="text-sm text-muted-foreground cursor-pointer">
              Technical details (dev only)
            </summary>
            <pre className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap bg-gray-100 dark:bg-gray-800 p-2 rounded">
              {error.originalError}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
} 