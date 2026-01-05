"use client"

import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface EmptyAuditStateProps {
  /**
   * Number of pages audited (optional, for display)
   */
  pagesAudited?: number
  /**
   * Whether to show as a card (for homepage) or inline (for table)
   */
  variant?: "card" | "inline"
}

/**
 * Shared empty audit state component used across homepage and dashboard
 * Displays a consistent message when no issues are found in an audit
 */
export function EmptyAuditState({ pagesAudited, variant = "card" }: EmptyAuditStateProps) {
  // Dynamic message with pagesAudited number (properly handles singular/plural)
  const message = typeof pagesAudited === 'number' && pagesAudited > 0
    ? `Your content looks great! We audited ${pagesAudited} page${pagesAudited === 1 ? '' : 's'} and found no issues.`
    : "Your content looks great! We found no issues."

  if (variant === "card") {
    return (
      <section className="border-t border-border py-12 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 max-w-2xl">
          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardContent className="p-6 sm:p-8 md:p-12 text-center">
              <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-green-600 mx-auto mb-4" />
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-light tracking-tight mb-3 sm:mb-4">
                No issues found
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-2 px-2 sm:px-0">
                {message}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground px-2 sm:px-0">
                Keep up the good work maintaining high-quality content.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  // Inline variant for table empty states
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">
        No issues found. Great job! ✅
      </p>
      <p className="text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  )
}

