"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle2, FileText, Search, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase-browser"
import { AuditResults } from "@/components/AuditResults"

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [auditResults, setAuditResults] = useState<any>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }
    checkAuth()
  }, [])

  const handleAudit = async () => {
    if (!url) {
      toast({
        title: "URL required",
        description: "Please enter a website URL to audit",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    setAuditResults(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const baseUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || ''

      const response = await fetch(`${baseUrl}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ domain: url })
      })

      // Check content type before parsing
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (!response.ok) {
        if (isJson) {
          const error = await response.json()
          throw new Error(error.error || 'Audit failed')
        } else {
          // Response is HTML or other format (likely an error page)
          const text = await response.text()
          console.error('Non-JSON error response:', text.substring(0, 200))
          throw new Error(`Audit failed: ${response.status} ${response.statusText}`)
        }
      }

      // Parse JSON response
      if (!isJson) {
        const text = await response.text()
        console.error('Non-JSON success response:', text.substring(0, 200))
        throw new Error('Invalid response format from server')
      }

      const data = await response.json()
      setAuditResults(data)
      
      // Store session token if provided (for unauthenticated users)
      // This enables claiming the audit after signup
      if (data.sessionToken) {
        setSessionToken(data.sessionToken)
        console.log('[Homepage] Received session token for audit:', data.sessionToken)
      }
    } catch (error) {
      console.error('Audit error:', error)
      let errorMessage = "Failed to run audit"
      
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message
        } else if ('error' in error && typeof error.error === 'string') {
          errorMessage = error.error
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      toast({
        title: "Audit failed",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="text-2xl font-serif font-semibold tracking-tight">Fortress</div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button onClick={() => router.push('/dashboard')}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => router.push('/sign-up')}>Sign In</Button>
                <Button onClick={() => router.push('/sign-up')}>Get Started</Button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl font-light tracking-tight text-balance mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            Get a full content audit of your website
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed text-balance mb-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Identify all the content issues, errors and inconsistencies across your site. No signup needed.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto mb-12">
            <Input 
              placeholder="Enter your website URL (e.g., fortress.app)" 
              className="h-14 px-6 text-lg bg-background shadow-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
            />
            <Button 
              size="lg" 
              className={`h-14 px-8 text-lg font-medium transition-opacity ${loading ? 'opacity-80 cursor-wait' : ''}`} 
              onClick={handleAudit} 
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Run Audit"
              )}
            </Button>
          </div>
          
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Free 10-page scan</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>No credit card required</span>
            </div>
          </div>
        </div>
      </section>

      {/* Audit Results Preview */}
      {auditResults && (
        <AuditResults 
          results={auditResults} 
          isAuthenticated={isAuthenticated}
          sessionToken={sessionToken}
        />
      )}

      {/* Features Section */}
      <section id="features" className="border-t border-border py-24 md:py-32">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-16">
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
              <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-foreground mb-6">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="font-serif text-2xl font-semibold mb-4">Crawl Your Site</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automatically scan up to 10 pages of your website to identify content issues and inconsistencies.
              </p>
            </div>

            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
              <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-foreground mb-6">
                <FileText className="h-8 w-8" />
              </div>
              <h3 className="font-serif text-2xl font-semibold mb-4">Get Actionable Insights</h3>
              <p className="text-muted-foreground leading-relaxed">
                Receive prioritized recommendations with specific examples and URLs to help you improve your content.
              </p>
            </div>

            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-600">
              <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-foreground mb-6">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="font-serif text-2xl font-semibold mb-4">Track Progress</h3>
              <p className="text-muted-foreground leading-relaxed">
                Save your audit results and re-run to track improvements over time. Regular audits coming soon.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="font-serif text-xl font-semibold">Fortress</div>
            <div className="flex items-center gap-8">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Documentation
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">© 2025 Fortress. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}