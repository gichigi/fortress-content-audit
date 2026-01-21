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
import { AlertCircle } from "lucide-react"

interface DomainLimitReachedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: 'free' | 'pro' | 'enterprise'
  currentDomains: number
  domainLimit: number
}

export function DomainLimitReachedModal({
  open,
  onOpenChange,
  plan,
  currentDomains,
  domainLimit,
}: DomainLimitReachedModalProps) {
  const handleUpgrade = () => {
    window.location.href = '/pricing'
  }

  const getUpgradeButtonText = () => {
    if (plan === 'free') {
      return 'Upgrade to Pro'
    } else if (plan === 'pro') {
      return 'Upgrade to Enterprise'
    }
    return 'View Plans'
  }

  const getBodyText = () => {
    if (plan === 'free') {
      return (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            You can audit 1 domain on the Free plan.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Remove an existing domain to add a new one</li>
            <li>Or upgrade to Pro to audit up to 5 domains</li>
          </ol>
        </>
      )
    } else if (plan === 'pro') {
      return (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            You can audit 5 domains on the Pro plan.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Remove an existing domain to add a new one</li>
            <li>Or upgrade to Enterprise for unlimited domains</li>
          </ol>
        </>
      )
    }
    return null
  }

  // Enterprise users should never see this modal
  if (plan === 'enterprise') {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <DialogTitle className="font-serif text-2xl font-semibold">
              Domain Limit Reached
            </DialogTitle>
          </div>
          <DialogDescription>
            You've reached your domain limit
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {getBodyText()}
        </div>

        <DialogFooter className="gap-3 sm:gap-3 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          <Button
            onClick={handleUpgrade}
            className="w-full sm:w-auto"
          >
            {getUpgradeButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
