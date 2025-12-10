"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { InterstitialLoader } from "@/components/ui/interstitial-loader"

export function InterstitialLoaderDemo() {
  const [showInterstitialDemo, setShowInterstitialDemo] = useState(false)

  useEffect(() => {
    if (showInterstitialDemo) {
      // Auto-hide after 3 seconds for demo purposes
      const timer = setTimeout(() => setShowInterstitialDemo(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showInterstitialDemo])

  return (
    <>
      <Button onClick={() => setShowInterstitialDemo(true)} variant="outline" className="mb-4">
        Show "Finding your voice" Interstitial
      </Button>
      <InterstitialLoader
        open={showInterstitialDemo}
        title="Finding your voice..."
        description="We're preparing stylistic comparisons to help us understand your brand's communication style."
      />
      <div className="p-4 bg-background border border-border rounded mt-4">
        <p className="text-xs text-muted-foreground font-mono mb-2">Usage example:</p>
        <p className="text-xs text-muted-foreground font-mono">
          {'<InterstitialLoader'}
          <br />
          {'  open={showInterstitial}'}
          <br />
          {'  title="Finding your voice..."'}
          <br />
          {'  description="We\'re preparing stylistic comparisons..."'}
          <br />
          {'/>'}
        </p>
      </div>
    </>
  )
}


