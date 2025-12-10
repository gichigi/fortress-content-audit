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
      children,
      ...props
    },
    ref
  ) => {
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
          {description && <p className="text-muted-foreground">{description}</p>}
          {children}
        </div>
      </div>
    )
  }
)
InterstitialLoader.displayName = "InterstitialLoader"

export { InterstitialLoader }

