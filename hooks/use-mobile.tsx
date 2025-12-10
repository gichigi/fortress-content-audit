"use client"

import { useState, useEffect } from "react"

export function useMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window !== "undefined") {
      // Initial check
      setIsMobile(window.innerWidth < breakpoint)

      // Set up event listener for window resize
      const handleResize = () => {
        setIsMobile(window.innerWidth < breakpoint)
      }

      // Add event listener
      window.addEventListener("resize", handleResize)

      // Clean up
      return () => {
        window.removeEventListener("resize", handleResize)
      }
    }
  }, [breakpoint])

  return isMobile
}
