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
}

export function AuditStartedModal({
  open,
  onOpenChange,
  domain,
  tier,
  estimatedDuration,
}: AuditStartedModalProps) {
  const getTierMessage = () => {
    switch (tier) {
      case 'free':
        return 'Free tier: Auditing homepage + 1 key page'
      case 'pro':
        return 'Pro tier: Auditing up to 10-20 pages'
      case 'enterprise':
        return 'Enterprise tier: Full site audit'
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
                <li>Grammar and spelling errors</li>
                <li>SEO optimization opportunities</li>
                <li>Readability and structure</li>
                <li>Accessibility concerns</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan:</span>
              <span className="font-medium">{getTierMessage()}</span>
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
