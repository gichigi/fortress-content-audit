"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

export function FeedbackBanner() {
  const [showBanner, setShowBanner] = useState(true)

  useEffect(() => {
    const bannerDismissed = localStorage.getItem('fortress_feedback_banner_dismissed')
    if (bannerDismissed === 'true') {
      setShowBanner(false)
    }
  }, [])

  if (!showBanner) {
    return null
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('fortress_feedback_banner_dismissed', 'true')
  }

  return (
    <div className="px-3 py-2">
      <div className="bg-muted/40 border border-border rounded-lg px-3 py-2 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            Thanks for trying Fortress.{' '}
            <a
              href="https://tahi.notion.site/e0a60b19dbda459aa694a80337c5fc1e?pvs=105"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-foreground/80 underline transition-colors"
            >
              Give Feedback
            </a>
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-0.5 hover:bg-muted rounded transition-colors flex-shrink-0 mt-0.5"
          aria-label="Close feedback banner"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  )
}
