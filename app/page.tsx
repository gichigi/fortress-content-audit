"use client"

import { useState, useEffect } from "react"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, FileText, Search, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterstitialLoader } from "@/components/ui/interstitial-loader"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase-browser"
import { AuditTable } from "@/components/audit-table"
import { useAuditIssues } from "@/hooks/use-audit-issues"
import { HealthScoreCards } from "@/components/health-score-cards"
import { HealthScoreChart } from "@/components/health-score-chart"
import { useHealthScoreMetrics } from "@/hooks/use-health-score-metrics"
import { transformIssuesToTableRows } from "@/lib/audit-table-adapter"

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auditResults, setAuditResults] = useState<any>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  
  // For authenticated users, use the hook to fetch from database
  // For unauthenticated users, use issues directly from API response
  const { tableRows: hookTableRows, loading: issuesLoading, totalIssues: hookTotalIssues, refetch } = useAuditIssues(
    isAuthenticated && auditResults?.runId ? auditResults.runId : null,
    isAuthenticated ? authToken : null
  )

  // Transform issues from API response for unauthenticated users
  const responseTableRows = React.useMemo(() => {
    if (!isAuthenticated && auditResults?.issues && Array.isArray(auditResults.issues)) {
      return transformIssuesToTableRows(auditResults.issues)
    }
    return []
  }, [isAuthenticated, auditResults?.issues])

  const responseTotalIssues = React.useMemo(() => {
    if (!isAuthenticated && auditResults) {
      return auditResults.totalIssues || responseTableRows.length
    }
    return 0
  }, [isAuthenticated, auditResults?.totalIssues, responseTableRows.length])

  // Use hook data for authenticated, response data for unauthenticated
  const tableRows = isAuthenticated ? hookTableRows : responseTableRows
  const totalIssues = isAuthenticated ? hookTotalIssues : responseTotalIssues
  const isLoading = isAuthenticated ? issuesLoading : false

  // Calculate metrics using shared hook
  const metrics = useHealthScoreMetrics(tableRows)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      setAuthToken(session?.access_token || null)
    }
    checkAuth()
  }, [])

  const handleAudit = async () => {
    if (!url) {
      setError("Please enter a website URL to audit")
      return
    }

    setLoading(true)
    setError(null)
    setAuditResults(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      setAuthToken(token || null)

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
        // Store in localStorage for auto-claim on dashboard
        localStorage.setItem('audit_session_token', data.sessionToken)
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
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl font-light tracking-tight text-balance mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            Get a full content audit of your website
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed text-balance mb-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Content issues are killing your conversion rate. Uncover the hidden errors and inconsistencies across your site. 
          </p>
          
          {!isAuthenticated ? (
            <div className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto mb-12">
              <Input 
                placeholder="Enter your website" 
                className="h-14 px-6 text-lg bg-background shadow-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
              />
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg font-medium" 
                onClick={handleAudit} 
                disabled={loading}
                aria-busy={loading}
              >
                Run Audit
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto mb-12 justify-center">
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg font-medium" 
                onClick={() => router.push('/dashboard')}
              >
                Go to Dashboard
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="h-14 px-8 text-lg font-medium" 
                onClick={() => router.push('/pricing')}
              >
                View Pricing
              </Button>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Find issues in minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Search your whole website</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Download reports in PDF or JSON</span>
            </div>
          </div>
        </div>
      </section>

      {/* Loading State */}
      <InterstitialLoader 
        open={loading}
        title="Analyzing your website..."
        description="Scanning pages and identifying content issues. This may take a moment."
      />

      {/* Error Alert */}
      {error && !loading && (
        <section className="border-t border-border py-24 md:py-32">
          <div className="container mx-auto px-6 max-w-2xl">
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        </section>
      )}

      {/* Audit Results Preview */}
      {!loading && auditResults && auditResults.runId && (
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
            {/* Health Score Cards */}
            <HealthScoreCards
              currentScore={!isLoading ? {
                score: metrics.score,
                metrics: {
                  totalActive: metrics.totalActive,
                  totalCritical: metrics.totalCritical,
                  pagesWithIssues: metrics.pagesWithIssues,
                  criticalPages: metrics.criticalPages,
                }
              } : undefined}
              previousScore={undefined}
              loading={isLoading}
            />


            {/* Audit Issues Table */}
            {isLoading ? (
              <div className="px-4 lg:px-6 space-y-4">
                <Skeleton className="h-10 w-48 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-64" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ) : tableRows.length > 0 ? (
              <div className="px-4 lg:px-6">
                <AuditTable
                  data={tableRows}
                  showPreview={true}
                  auditId={auditResults.runId}
                  totalIssues={totalIssues}
                  hideSearch={true}
                  hideTabs={true}
                  readOnly={true}
                  onStatusUpdate={refetch}
                />
              </div>
            ) : (
              <div className="px-4 lg:px-6">
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No issues found</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Issues Success State - shown when audit completes but no issues found */}
      {!loading && auditResults && auditResults.runId && !isLoading && tableRows.length === 0 && (
        <section className="border-t border-border py-24 md:py-32">
          <div className="container mx-auto px-6 max-w-2xl">
            <Card className="border-2 border-green-200 bg-green-50/50">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="font-serif text-3xl md:text-4xl font-light tracking-tight mb-4">
                  No issues found
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-2">
                  Your content looks great! We scanned {auditResults.meta?.pagesScanned || auditResults.pagesScanned || 0} pages and found no issues.
                </p>
                <p className="text-sm text-muted-foreground">
                  Keep up the good work maintaining high-quality content.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
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