"use client"
// NOTE: Deprioritized for audit-first MVP - brand voice guidelines feature kept for existing users

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Globe, PenTool, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function StartPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [showUrlInput, setShowUrlInput] = useState(false)

  const handleWebsiteSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!url.trim()) return

    // Redirect to audit flow
    router.push(`/?url=${encodeURIComponent(url.trim())}`)
  }

  const handleManualSelect = () => {
    // Redirect to home page for audit
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-serif font-semibold tracking-tight hover:opacity-80 transition-opacity">
            Fortress
          </Link>
          <div className="flex items-center gap-8">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back to Home
            </Link>
          </div>
        </nav>
      </header>
      
      <main className="container mx-auto px-6 py-24 max-w-4xl animate-in fade-in duration-500">
        <div className="mb-16 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-light tracking-tight mb-6">
            How should we start?
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            We'll generate your brand voice. You can edit it anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Option 1: Website */}
          <Card 
            className={`cursor-pointer transition-all duration-300 hover:border-primary/50 ${showUrlInput ? 'border-primary ring-1 ring-primary' : ''}`}
            onClick={() => setShowUrlInput(true)}
          >
            <CardContent className="p-8 flex flex-col items-center text-center h-full min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                <Globe className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-serif text-2xl font-semibold mb-3">Read Your Website</h3>
              <p className="text-muted-foreground mb-3">
                  Generate a new brand voice from the details on your website.
              </p>
              <Badge variant="outline" className="mb-6 text-xs font-normal">
                ~ 6 mins
              </Badge>
              
              {showUrlInput ? (
                <div className="w-full mt-auto animate-in fade-in zoom-in duration-300 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <form onSubmit={handleWebsiteSubmit} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="example.com" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        autoFocus
                        className="bg-background flex-1"
                      />
                      <Button type="submit" size="icon" disabled={!url.trim()}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Space reserved for validation errors */}
                    <div className="min-h-[20px]"></div>
                  </form>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Option 2: Manual */}
          <Card 
            className="cursor-pointer transition-all duration-300 hover:border-primary/50 group"
            onClick={handleManualSelect}
          >
            <CardContent className="p-8 flex flex-col items-center text-center h-full min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                <PenTool className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-serif text-2xl font-semibold mb-3">Enter details manually</h3>
              <p className="text-muted-foreground mb-3">
              Generate a new brand voice from scratch. 
              </p>
              <Badge variant="outline" className="mb-6 text-xs font-normal">
                ~ 12 mins
              </Badge>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
