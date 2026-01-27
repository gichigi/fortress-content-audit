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
import { Loader2, Info } from "lucide-react"

interface AuditStartedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  domain: string
  tier: 'free' | 'pro' | 'enterprise'
  estimatedDuration: string
  pagesFound?: number | null
  pagesAudited?: number
}

export function AuditStartedModal({
  open,
  onOpenChange,
  domain,
  tier,
  estimatedDuration,
  pagesFound,
  pagesAudited,
}: AuditStartedModalProps) {
  const getTierMessage = () => {
    const maxPages = tier === 'free' ? 5 : tier === 'pro' ? 20 : 60

    // If we have pages found, show it
    if (pagesFound && pagesFound > 0) {
      return `Found ${pagesFound} ${pagesFound === 1 ? 'page' : 'pages'} · Auditing up to ${maxPages}`
    }

    // Fallback to tier-based messaging
    switch (tier) {
      case 'free':
        return 'Auditing up to 5 pages (Free)'
      case 'pro':
        return 'Auditing up to 20 pages (Pro)'
      case 'enterprise':
        return 'Full site audit (Enterprise)'
      default:
        return 'Auditing your site'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <DialogTitle className="font-serif text-2xl font-semibold">
              Audit Started
            </DialogTitle>
          </div>
          <DialogDescription>
            Auditing {domain}...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="outline">
            <Info className="h-4 w-4" />
            <AlertTitle>What&apos;s happening</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p className="text-sm">
                We&apos;re analyzing your content for issues including:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>Spelling and grammar issues</li>
                <li>Page consistency and formatting</li>
                <li>Broken links and navigation</li>
                <li>Calls to action and messaging</li>
                <li>Content clarity and readability</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm">
            {pagesFound !== null && pagesFound !== undefined && pagesFound > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pages found:</span>
                <span className="font-medium">{pagesFound}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auditing:</span>
              <span className="font-medium">Up to {tier === 'free' ? 5 : tier === 'pro' ? 20 : 60} pages</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected duration:</span>
              <span className="font-medium">{estimatedDuration}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            You can close this dialog and the audit will continue in the background.
            You&apos;ll see the results when it completes.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
