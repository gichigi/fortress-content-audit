"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PageDiscoveryInlineProps {
  discoveredPages: string[]
  auditedUrls: string[] // Actual list of audited URLs (replaces pagesAudited number)
  pagesFound: number | null
  isAuthenticated?: boolean
}

// Format URL for display (show path only, truncate if needed)
function formatUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "")
    // Truncate long paths
    const maxLen = 30
    if (path.length > maxLen) {
      return path.substring(0, maxLen - 3) + "..."
    }
    return path || "/"
  } catch {
    return url
  }
}

// Check if a URL was audited by comparing against actual auditedUrls list
function isAudited(url: string, auditedUrls: string[]): boolean {
  return auditedUrls.some(audited => {
    try {
      const auditedPath = new URL(audited).pathname.replace(/\/$/, "")
      const urlPath = new URL(url).pathname.replace(/\/$/, "")
      return auditedPath === urlPath
    } catch {
      return audited === url
    }
  })
}

// Get page priority for intelligent sorting
function getPagePriority(url: string): number {
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/$/, "")

    // Homepage always first
    if (path === '' || path === '/') return 0

    // Key pages in priority order
    if (path.includes('/pricing') || path.includes('/plans')) return 1
    if (path.includes('/about')) return 2
    if (path.includes('/features') || path.includes('/product')) return 3
    if (path.includes('/contact') || path.includes('/support')) return 4
    if (path.includes('/blog') || path.includes('/changelog')) return 5
    if (path.includes('/faq') || path.includes('/help')) return 6

    // Everything else
    return 10
  } catch {
    return 10
  }
}

// Reorder array for column-major layout (top-to-bottom, left-to-right)
function reorderForColumns(items: string[], numColumns: number): string[] {
  if (items.length === 0) return items

  const numRows = Math.ceil(items.length / numColumns)
  const reordered = new Array(items.length)

  for (let i = 0; i < items.length; i++) {
    const col = Math.floor(i / numRows)
    const row = i % numRows
    const newIndex = row * numColumns + col
    if (newIndex < items.length) {
      reordered[newIndex] = items[i]
    }
  }

  return reordered.filter(Boolean) // Remove any undefined
}

export function PageDiscoveryInline({
  discoveredPages,
  auditedUrls,
  pagesFound,
  isAuthenticated = false
}: PageDiscoveryInlineProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  // Detect screen size: desktop = 5-down-then-across; mobile = single column
  useEffect(() => {
    const update = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Use pagesFound if available, otherwise fall back to discoveredPages length
  const totalPages = pagesFound ?? discoveredPages.length
  const auditedCount = auditedUrls.length

  // Don't render if no pages discovered
  if (totalPages === 0) return null

  // Sort pages intelligently: audited first, then by priority, then alphabetically
  const sortedPages = [...discoveredPages].sort((a, b) => {
    const aAudited = isAudited(a, auditedUrls)
    const bAudited = isAudited(b, auditedUrls)

    // Audited pages first
    if (aAudited && !bAudited) return -1
    if (!aAudited && bAudited) return 1

    // Then by priority
    const aPriority = getPagePriority(a)
    const bPriority = getPagePriority(b)
    if (aPriority !== bPriority) return aPriority - bPriority

    // Finally alphabetically
    return a.localeCompare(b)
  })

  const initialShowCount = 12 // Show more pages initially for better overview
  const limitedPages = showAll ? sortedPages : sortedPages.slice(0, initialShowCount)
  const hasMore = sortedPages.length > initialShowCount

  // Desktop: 5 down then across (column-major). Mobile: single column.
  const numColumns = isDesktop ? Math.max(1, Math.ceil(limitedPages.length / 5)) : 1
  const pagesToShow = numColumns > 1
    ? reorderForColumns(limitedPages, numColumns)
    : limitedPages

  // Tier limits
  const freeLimit = 5
  const proLimit = 20

  return (
    <div className="text-sm">
      {/* Summary line with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
      >
        <span>
          <span className="text-foreground font-medium">{auditedCount}</span>
          {" of "}
          <span className="text-foreground font-medium">{totalPages}</span>
          {" pages audited"}
        </span>
        <span className="text-muted-foreground/60">·</span>
        {!isAuthenticated ? (
          <span className="text-muted-foreground">
            Free audit: up to {freeLimit} pages · <span className="text-foreground">Pro audit: up to {proLimit} pages</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Pro audit</span>
        )}
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>

      {/* Expandable page list - single column mobile, multi-column desktop */}
      {isExpanded && discoveredPages.length > 0 && (
        <div className="mt-3 pl-0.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className="grid grid-cols-1 gap-x-6 gap-y-1.5"
            style={isDesktop && numColumns > 1 ? { gridTemplateColumns: `repeat(${numColumns}, 1fr)` } : undefined}
          >
            {pagesToShow.map((url, i) => {
              const audited = isAudited(url, auditedUrls)
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm min-w-0 ${audited ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {audited ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className="font-mono text-xs truncate">{formatUrl(url)}</span>
                </div>
              )
            })}
          </div>

          {/* Show more/less toggle */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground mt-2"
              onClick={(e) => {
                e.stopPropagation()
                setShowAll(!showAll)
              }}
            >
              {showAll ? "Show less" : `Show all ${sortedPages.length} pages`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
