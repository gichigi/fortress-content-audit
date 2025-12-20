"use client"

import { useState, useEffect } from "react"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, FileText, Search, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterstitialLoader } from "@/components/ui/interstitial-loader"
import { createClient } from "@/lib/supabase-browser"
import { AuditTable } from "@/components/audit-table"
import { useAuditIssues } from "@/hooks/use-audit-issues"
import { HealthScoreCards } from "@/components/health-score-cards"
import { HealthScoreChart } from "@/components/health-score-chart"
import { useHealthScoreMetrics } from "@/hooks/use-health-score-metrics"
import { transformIssuesToTableRows } from "@/lib/audit-table-adapter"
import { EmptyAuditState } from "@/components/empty-audit-state"

// Client-side URL validation (simplified version of validateUrl)
function validateUrlClient(input: string): { isValid: boolean; error?: string; normalizedUrl?: string } {
  if (!input || !input.trim()) {
    return { isValid: false, error: "Enter a website URL" }
  }

  try {
    // Add https if no protocol specified
    let urlString = input.trim()
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString
    }

    // Try to construct URL object
    const url = new URL(urlString)

    // Basic validation checks
    if (!url.hostname) {
      return { isValid: false, error: "Invalid URL" }
    }

    // Check for common issues
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return { isValid: false, error: "Localhost URLs not allowed" }
    }

    // Validate hostname has a valid TLD
    const hostname = url.hostname.toLowerCase()
    const tldPattern = /\.[a-z]{2,}$/i
    if (!hostname.includes('.') || !tldPattern.test(hostname)) {
      return { isValid: false, error: "Invalid domain format" }
    }

    // Reject invalid domain patterns
    if (hostname.includes('..') || hostname.startsWith('.') || hostname.endsWith('.')) {
      return { isValid: false, error: "Invalid domain format" }
    }

    // Normalize to origin (remove path, query, etc.)
    const normalizedUrl = url.origin

    return { isValid: true, normalizedUrl }
  } catch (error) {
    return { 
      isValid: false, 
      error: "Invalid URL format" 
    }
  }
}

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null) // Client-side validation errors
  const [apiError, setApiError] = useState<string | null>(null) // API/server errors
  const [touched, setTouched] = useState(false) // Track if input has been interacted with
  const [auditResults, setAuditResults] = useState<any>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [progressInfo, setProgressInfo] = useState<{ pagesScanned: number; pagesBeingCrawled: string[]; reasoningSummaries: string[] }>({
    pagesScanned: 0,
    pagesBeingCrawled: [],
    reasoningSummaries: []
  })
  
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

  // TEST: Force empty state via query param (remove after testing)
  const [testEmptyState, setTestEmptyState] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('testEmpty') === 'true') {
      setTestEmptyState(true)
    }
  }, [])

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

  // Poll for audit progress when audit is in progress
  useEffect(() => {
    // Only poll if we have a responseId and audit is in progress
    const responseId = auditResults?.responseId || auditResults?.meta?.responseId
    if (!responseId || !loading) {
      return
    }

    let pollInterval: NodeJS.Timeout | null = null

    const pollStatus = async () => {
      try {
        const baseUrl =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || ''

        const pollResponse = await fetch(`${baseUrl}/api/audit/poll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          },
          body: JSON.stringify({
            responseId,
            runId: auditResults?.runId
          })
        })

        if (!pollResponse.ok) {
          console.error('[Poll] Failed to poll status')
          return
        }

        const pollData = await pollResponse.json()

        if (pollData.status === 'in_progress') {
          // Update progress info
          setProgressInfo({
            pagesScanned: pollData.progress?.pagesScanned || 0,
            pagesBeingCrawled: pollData.progress?.auditedUrls || [],
            reasoningSummaries: pollData.progress?.reasoningSummaries || []
          })
        } else if (pollData.status === 'completed') {
          // Audit completed, update results and stop polling
          setAuditResults(pollData)
          setLoading(false)
          setProgressInfo({ pagesScanned: 0, pagesBeingCrawled: [], reasoningSummaries: [] })
          if (pollInterval) {
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('[Poll] Error polling status:', error)
      }
    }

    // Poll immediately, then every 5 seconds
    pollStatus()
    pollInterval = setInterval(pollStatus, 5000)

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [auditResults?.responseId, auditResults?.meta?.responseId, auditResults?.runId, loading, authToken])

  // Validate on blur for better UX
  const handleBlur = () => {
    setTouched(true)
    if (url.trim()) {
      const validation = validateUrlClient(url)
      if (!validation.isValid) {
        setValidationError(validation.error || "Please enter a valid website URL")
      } else {
        setValidationError(null)
      }
    } else {
      setValidationError(null)
    }
  }

  const handleAudit = async () => {
    setTouched(true)
    setApiError(null) // Clear API errors on new submission
    
    // Validate URL client-side first
    const validation = validateUrlClient(url)
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid URL")
      return
    }

    setValidationError(null)
    setLoading(true)
    setApiError(null)
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

      // Use normalized URL if available, otherwise use original
      const domainToSubmit = validation.normalizedUrl || url.trim()

      const response = await fetch(`${baseUrl}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ domain: domainToSubmit })
      })

      // Check content type before parsing
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (!response.ok) {
        if (isJson) {
          const errorData = await response.json()
          
          // Provide specific error messages based on status code
          if (response.status === 400) {
            throw new Error(errorData.error || 'Invalid URL')
          } else if (response.status === 429) {
            throw new Error(errorData.message || errorData.error || 'Too many requests. Try again later.')
          } else if (response.status === 403) {
            throw new Error('Upgrade to Pro or Enterprise')
          } else if (response.status === 401) {
            throw new Error('Please sign in')
          } else if (response.status === 500) {
            throw new Error('Server error. Try again.')
          } else {
            throw new Error(errorData.error || errorData.message || `Failed to start audit`)
          }
        } else {
          // Response is HTML or other format (likely an error page)
          const text = await response.text()
          console.error('Non-JSON error response:', text.substring(0, 200))
          
          if (response.status === 429) {
            throw new Error('Too many requests. Try again later.')
          } else if (response.status >= 500) {
            throw new Error('Server error. Try again.')
          } else {
            throw new Error('Failed to start audit')
          }
        }
      }

      // Parse JSON response
      if (!isJson) {
        const text = await response.text()
        console.error('Non-JSON success response:', text.substring(0, 200))
        throw new Error('Server error')
      }

      const data = await response.json()
      setAuditResults(data)
      
      // If audit is in progress, keep loading state and start polling
      if (data.status === 'in_progress' || data.responseId || data.meta?.responseId) {
        setLoading(true)
        // Initialize progress info if available
        if (data.progress) {
          setProgressInfo({
            pagesScanned: data.progress.pagesScanned || 0,
            pagesBeingCrawled: data.progress.auditedUrls || []
          })
        }
      } else {
        // Audit completed immediately, stop loading
        setLoading(false)
      }
      
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
      let errorMessage = "Failed to start audit"
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = "Network error. Check your connection."
      } else if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message
        } else if ('error' in error && typeof error.error === 'string') {
          errorMessage = error.error
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      setApiError(errorMessage)
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
            Content issues kill conversion rates. Uncover the hidden errors and inconsistencies across your site. 
          </p>
          
          {!isAuthenticated ? (
            <div className="flex flex-col gap-4 max-w-xl mx-auto mb-12">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <Input 
                    placeholder="example.com" 
                    className={`h-14 px-6 text-lg bg-background shadow-sm transition-colors ${
                      validationError && touched 
                        ? 'border-destructive focus-visible:ring-destructive' 
                        : 'border-input'
                    }`}
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value)
                      // Clear validation error when user starts typing
                      if (validationError) setValidationError(null)
                      // Clear API error when user starts typing
                      if (apiError) setApiError(null)
                    }}
                    onBlur={handleBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAudit()
                      }
                    }}
                    aria-invalid={!!validationError && touched}
                    aria-describedby={validationError && touched ? "url-error" : undefined}
                    id="url-input"
                  />
                  {/* Inline validation error message */}
                  {validationError && touched && (
                    <p 
                      id="url-error" 
                      className="text-sm text-destructive mt-1 animate-in fade-in slide-in-from-top-1"
                      role="alert"
                    >
                      {validationError}
                    </p>
                  )}
                </div>
                <Button 
                  size="lg" 
                  className="h-14 px-8 text-lg font-medium shrink-0" 
                  onClick={handleAudit} 
                  disabled={loading || (touched && !!validationError)}
                  aria-busy={loading}
                >
                  {loading ? "Starting..." : "Run Audit"}
                </Button>
              </div>
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
        pagesScanned={progressInfo.pagesScanned}
        pagesBeingCrawled={progressInfo.pagesBeingCrawled}
        reasoningSummaries={progressInfo.reasoningSummaries}
      />

      {/* API Error Message (for errors that occur after submission) */}
      {apiError && !loading && (
        <section className="border-t border-border py-12 md:py-16">
          <div className="container mx-auto px-6 max-w-2xl text-center">
            <p className="text-destructive text-sm" role="alert">{apiError}</p>
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
            ) : !testEmptyState && tableRows.length > 0 ? (
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
            ) : null}
          </div>
        </div>
      )}

      {/* No Issues Success State - shown when audit completes but no issues found */}
      {!loading && auditResults && auditResults.runId && !isLoading && (testEmptyState || tableRows.length === 0) && (
        <EmptyAuditState 
          pagesScanned={testEmptyState ? 5 : (auditResults.meta?.pagesScanned ?? auditResults.pagesScanned ?? undefined)}
          variant="card"
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