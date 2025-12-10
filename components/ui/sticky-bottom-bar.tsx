"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface StickyBottomBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum width container. Defaults to max-w-4xl.
   */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full"
  /**
   * Content alignment. Defaults to "end" (right-aligned).
   */
  align?: "start" | "center" | "end"
  /**
   * Z-index value. Defaults to 10.
   */
  zIndex?: number
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  full: "max-w-full",
}

const alignClasses = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
}

const StickyBottomBar = React.forwardRef<HTMLDivElement, StickyBottomBarProps>(
  ({ className, maxWidth = "4xl", align = "end", zIndex = 10, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t border-border flex",
          alignClasses[align]
        )}
        style={{ zIndex }}
        {...props}
      >
        <div className={cn("container", maxWidthClasses[maxWidth], "flex", alignClasses[align])}>
          {children}
        </div>
      </div>
    )
  }
)
StickyBottomBar.displayName = "StickyBottomBar"

export { StickyBottomBar }

