"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface InterstitialLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Main heading text displayed in serif font
   */
  title?: string
  /**
   * Optional description text below the title
   */
  description?: string
  /**
   * Show loading spinner. Defaults to true.
   */
  showSpinner?: boolean
  /**
   * Z-index value. Defaults to 50.
   */
  zIndex?: number
  /**
   * Whether the loader is visible
   */
  open?: boolean
  /**
   * List of pages currently being crawled (for progress display)
   */
  pagesBeingCrawled?: string[]
  /**
   * Number of pages audited so far
   */
  pagesAudited?: number
  /**
   * Reasoning summaries from the model's thinking process
   */
  reasoningSummaries?: string[]
}

const InterstitialLoader = React.forwardRef<HTMLDivElement, InterstitialLoaderProps>(
  (
    {
      className,
      title,
      description,
      showSpinner = true,
      zIndex = 50,
      open = true,
      pagesBeingCrawled = [],
      pagesAudited = 0,
      reasoningSummaries = [],
      children,
      ...props
    },
    ref
  ) => {
    const [currentSummaryIndex, setCurrentSummaryIndex] = React.useState(0)
    const [isVisible, setIsVisible] = React.useState(true)

    // Canned reasoning summaries in the same style as model output
    const cannedSummaries = [
      "Reviewing homepage content and structure",
      "Checking for spelling and grammar issues",
      "Analyzing page consistency and formatting",
      "Identifying broken links and navigation issues",
      "Reviewing calls to action and messaging",
      "Assessing content clarity and readability",
      "Checking for factual accuracy and claims",
      "Analyzing user experience and flow",
      "Reviewing footer and contact information",
      "Compiling findings and recommendations",
    ]

    // Use canned summaries instead of reasoningSummaries prop
    const summaries = cannedSummaries

    // Rotate through summaries with fade animation
    React.useEffect(() => {
      if (summaries.length === 0) {
        setCurrentSummaryIndex(0)
        setIsVisible(true)
        return
      }

      // Reset to first summary if index is out of bounds
      if (currentSummaryIndex >= summaries.length) {
        setCurrentSummaryIndex(0)
      }

      const interval = setInterval(() => {
        setIsVisible(false)
        setTimeout(() => {
          setCurrentSummaryIndex((prev) => (prev + 1) % summaries.length)
          setIsVisible(true)
        }, 300) // Wait for fade out
      }, 5000) // Change every 5 seconds

      return () => clearInterval(interval)
    }, [summaries.length, currentSummaryIndex])

    if (!open) return null

    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 bg-background z-50 flex items-center justify-center animate-in fade-in duration-300",
          className
        )}
        style={{ zIndex }}
        {...props}
      >
        <div className="text-center max-w-md px-6">
          {showSpinner && (
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-6" />
          )}
          {title && (
            <h2 className="font-serif text-3xl font-light tracking-tight mb-4">{title}</h2>
          )}
          {description && <p className="text-muted-foreground mb-4">{description}</p>}
          
          {/* Canned summaries carousel */}
          {summaries.length > 0 && currentSummaryIndex < summaries.length && (
            <div className="mt-6 mb-6 min-h-[100px] flex items-center justify-center">
              <div
                key={currentSummaryIndex}
                className={cn(
                  "text-base text-muted-foreground italic max-w-lg transition-opacity duration-300 ease-in-out",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
              >
                "{summaries[currentSummaryIndex]}"
              </div>
            </div>
          )}
          
          {/* Progress info */}
          {(pagesAudited > 0 || pagesBeingCrawled.length > 0) && (
            <div className="mt-6 space-y-3 text-left max-w-lg mx-auto">
              {pagesAudited > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Pages audited: {pagesAudited}
                </p>
              )}
              {pagesBeingCrawled.length > 0 && (
                <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground text-center mb-2">
                    Currently crawling:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1.5 max-h-40 overflow-y-auto">
                    {pagesBeingCrawled.map((url, idx) => (
                      <li key={idx} className="truncate px-2 py-1 bg-background/50 rounded">
                        {url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {children}
        </div>
      </div>
    )
  }
)
InterstitialLoader.displayName = "InterstitialLoader"

export { InterstitialLoader }

