"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Clock, WifiOff, Shield, MailIcon } from "lucide-react"
import type { ClassifiedError } from "@/lib/error-classifier"

interface AuditFailureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  domain: string
  error: ClassifiedError
  onRetry?: () => void
  onContactSupport?: () => void
  userTier?: 'free' | 'pro' | 'enterprise'
}

export function AuditFailureModal({
  open,
  onOpenChange,
  domain,
  error,
  onRetry,
  onContactSupport,
  userTier = 'free',
}: AuditFailureModalProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    }
    onOpenChange(false)
  }

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport()
    } else {
      // Default: open email client
      window.location.href = `mailto:support@fortress-audit.com?subject=Audit%20Failed%20for%20${encodeURIComponent(domain)}&body=Error:%20${encodeURIComponent(error.message)}%0A%0ADetails:%20${encodeURIComponent(error.details)}`
    }
  }

  const handleRefreshPage = () => {
    window.location.reload()
  }

  const handleUpgrade = () => {
    window.location.href = '/pricing'
  }

  // Content based on error type
  const getIcon = () => {
    switch (error.type) {
      case 'rate_limit':
        return <AlertCircle className="h-8 w-8 text-destructive" />
      case 'bot_protection':
        return <Shield className="h-8 w-8 text-yellow-600" />
      case 'timeout':
        return <Clock className="h-8 w-8 text-orange-600" />
      case 'network_error':
        return <WifiOff className="h-8 w-8 text-blue-600" />
      default:
        return <AlertCircle className="h-8 w-8 text-destructive" />
    }
  }

  const getTitle = () => {
    switch (error.type) {
      case 'rate_limit':
        return 'Daily Limit Reached'
      case 'bot_protection':
        return 'Audit Blocked'
      case 'timeout':
        return 'Audit Timed Out'
      case 'network_error':
        return 'Connection Lost'
      case 'validation':
        return 'Invalid Request'
      default:
        return 'Audit Failed'
    }
  }

  const getDescription = () => {
    switch (error.type) {
      case 'rate_limit':
        return "You've reached your daily audit limit for this domain"
      case 'bot_protection':
        return 'Your website appears to have bot protection enabled'
      case 'timeout':
        return 'Your audit took longer than expected'
      case 'network_error':
        return 'Lost connection while running your audit'
      default:
        return 'Something went wrong during your audit'
    }
  }

  const getExplanation = () => {
    switch (error.type) {
      case 'rate_limit':
        return (
          <p className="text-sm text-muted-foreground">
            You have two options:
          </p>
        )
      case 'bot_protection':
        return (
          <>
            <p className="text-sm text-muted-foreground">
              Cloudflare, reCAPTCHA, or similar firewall detected. We cannot audit sites with active bot protection.
            </p>
            {error.details && (
              <Alert variant="outline" className="mt-2">
                <AlertDescription className="text-xs font-mono break-all">
                  {error.details}
                </AlertDescription>
              </Alert>
            )}
          </>
        )
      case 'timeout':
        return (
          <>
            <p className="text-sm text-muted-foreground">
              This usually happens with very large sites or slow servers.
              {error.pagesAudited && error.pagesAudited > 0
                ? ` We analyzed ${error.pagesAudited} page${error.pagesAudited > 1 ? 's' : ''} before timing out.`
                : ''}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {userTier === 'free'
                ? 'Free tier audits timeout after 4 minutes.'
                : 'Pro tier audits timeout after 7 minutes.'}
            </p>
          </>
        )
      case 'network_error':
        return (
          <p className="text-sm text-muted-foreground">
            Your audit may still be running in the background. Check back in a few minutes to see results.
          </p>
        )
      default:
        return (
          <>
            <p className="text-sm text-muted-foreground">{error.message}</p>
            {error.details && (
              <Alert variant="outline" className="mt-2">
                <AlertDescription className="text-xs font-mono break-all">
                  {error.details}
                </AlertDescription>
              </Alert>
            )}
          </>
        )
    }
  }

  const getNextSteps = () => {
    switch (error.type) {
      case 'rate_limit':
        return (
          <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
            <li>Wait until tomorrow to run your next audit</li>
            <li>Or upgrade to Pro for unlimited audits</li>
          </ol>
        )
      case 'bot_protection':
        return (
          <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
            <li>Temporarily disable bot protection or firewall</li>
            <li>Add our crawler to your allowlist</li>
            <li>Try the audit again</li>
            <li>Re-enable protection after audit completes</li>
          </ol>
        )
      case 'timeout':
        return (
          <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
            {error.pagesAudited && error.pagesAudited > 0 && (
              <li>Review partial results (if available)</li>
            )}
            {userTier === 'free' && (
              <li>Upgrade to Pro for 7-minute audits</li>
            )}
            <li>Try auditing a smaller section of your site</li>
            <li>Contact support if timeouts persist</li>
          </ol>
        )
      case 'network_error':
        return (
          <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
            <li>Refresh the page to check audit status</li>
            <li>Wait 2-3 minutes for audit to complete</li>
            <li>Try starting a new audit if needed</li>
          </ol>
        )
      case 'validation':
        return (
          <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
            <li>Check if the website URL is correct</li>
            <li>Ensure the URL includes http:// or https://</li>
            <li>Verify the domain is accessible in your browser</li>
          </ol>
        )
      default:
        return (
          <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
            <li>Check if the website URL is correct</li>
            <li>Ensure the site is accessible</li>
            <li>Try again in a few moments</li>
            <li>Contact support if issue persists</li>
          </ol>
        )
    }
  }

  const getPrimaryButton = () => {
    switch (error.type) {
      case 'rate_limit':
        return {
          label: 'Upgrade to Pro',
          action: handleUpgrade,
        }
      case 'bot_protection':
        return {
          label: 'Contact Support',
          action: handleContactSupport,
          icon: <MailIcon className="h-4 w-4" />,
        }
      case 'timeout':
        return userTier === 'free'
          ? { label: 'Upgrade to Pro', action: handleUpgrade }
          : { label: 'Contact Support', action: handleContactSupport }
      case 'network_error':
        return { label: 'Refresh Page', action: handleRefreshPage }
      default:
        return { label: 'Try Again', action: handleRetry }
    }
  }

  const primaryButton = getPrimaryButton()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle className="font-serif text-2xl font-semibold">
              {getTitle()}
            </DialogTitle>
          </div>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Explanation */}
          <div className="space-y-2">
            {getExplanation()}
          </div>

          {/* Next Steps */}
          <Alert variant="outline">
            <AlertTitle>Next Steps</AlertTitle>
            <AlertDescription>
              {getNextSteps()}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-3 sm:gap-3 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          {/* Show secondary action button for specific error types */}
          {error.type === 'timeout' && userTier !== 'free' && onRetry && (
            <Button
              variant="outline"
              onClick={handleRetry}
              className="w-full sm:w-auto"
            >
              Try Again
            </Button>
          )}
          {error.type === 'bot_protection' && onRetry && (
            <Button
              variant="outline"
              onClick={handleRetry}
              className="w-full sm:w-auto"
            >
              Try Again
            </Button>
          )}
          <Button
            onClick={primaryButton.action}
            className="w-full sm:w-auto gap-2"
          >
            {primaryButton.icon}
            {primaryButton.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
