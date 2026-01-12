"use client"

import { useState, useEffect, useRef } from "react"
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
  const [progressInfo, setProgressInfo] = useState<{ pagesAudited: number; pagesBeingCrawled: string[]; reasoningSummaries: string[] }>({
    pagesAudited: 0,
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

  // Ref for results section to enable scrolling
  const resultsRef = useRef<HTMLDivElement>(null)

  // Extract domain for display (remove protocol, trailing slashes)
  const displayDomain = React.useMemo(() => {
    if (!url) return null
    try {
      // Use the normalized URL if available from validation, otherwise parse the input
      const validation = validateUrlClient(url)
      if (validation.normalizedUrl) {
        const urlObj = new URL(validation.normalizedUrl)
        return urlObj.hostname
      }
      // Fallback: try to extract hostname from input
      let urlString = url.trim()
      if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        urlString = 'https://' + urlString
      }
      const urlObj = new URL(urlString)
      return urlObj.hostname
    } catch {
      // If parsing fails, return the input as-is (cleaned)
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    }
  }, [url])

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      setAuthToken(session?.access_token || null)
    }
    checkAuth()
  }, [])
  
  // Clean up any old localStorage entries from previous polling architecture
  useEffect(() => {
    localStorage.removeItem('pending_audit_runId')
    // Keep audit_session_token for dashboard claim functionality
  }, [])

  // Scroll to results when audit completes
  useEffect(() => {
    if (!loading && auditResults?.runId && resultsRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 100)
    }
  }, [loading, auditResults?.runId])

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

      // If response.ok, validation passed and audit started
      if (response.ok) {
        // Interstitial is shown via loading state (InterstitialLoader open={loading})
        // Keep loading=true to show interstitial during audit
        // Parse JSON response
        if (!isJson) {
          const text = await response.text()
          console.error('Non-JSON success response:', text.substring(0, 200))
          setLoading(false)
          setApiError('Server error')
          return
        }

        // Parse JSON response
        const data = await response.json()
        
        // Store session token if provided (for unauthenticated users - used for dashboard claim)
        if (data.sessionToken) {
          setSessionToken(data.sessionToken)
          localStorage.setItem('audit_session_token', data.sessionToken)
          console.log('[Homepage] Received session token for audit:', data.sessionToken)
        }
        
        // Audit now completes synchronously - should always be 'completed' or error
        if (data.status === 'completed') {
          setLoading(false)
          setAuditResults(data)
        } else {
          setLoading(false)
          // Bot protection or other errors - check for bot protection message
          const botProtectionMsg = data.error?.toLowerCase().includes('bot protection')
            ? data.error
            : null
          setApiError(botProtectionMsg || data.error || "Audit failed")
        }
        
        return
      } else {
        // Validation errors - show inline
        setLoading(false)
        
        if (isJson) {
          const errorData = await response.json()
          
          // Provide specific error messages based on status code
          let errorMessage = 'Failed to start audit'
          if (response.status === 400) {
            errorMessage = errorData.error || 'Invalid URL'
          } else if (response.status === 429) {
            errorMessage = errorData.message || errorData.error || 'Too many requests. Try again later.'
          } else if (response.status === 403) {
            errorMessage = 'Upgrade to Pro or Enterprise'
          } else if (response.status === 401) {
            errorMessage = 'Please sign in'
          } else if (response.status === 500) {
            // Check for bot protection error message
            const botProtectionMsg = errorData.error?.toLowerCase().includes('bot protection')
              ? errorData.error
              : null
            errorMessage = botProtectionMsg || 'Server error. Try again.'
          } else {
            errorMessage = errorData.error || errorData.message || `Failed to start audit`
          }
          
          setApiError(errorMessage)
        } else {
          // Response is HTML or other format (likely an error page)
          const text = await response.text()
          console.error('Non-JSON error response:', text.substring(0, 200))
          
          let errorMessage = 'Failed to start audit'
          if (response.status === 429) {
            errorMessage = 'Too many requests. Try again later.'
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Try again.'
          }
          
          setApiError(errorMessage)
        }
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
      setLoading(false)
    }
    // Note: Don't use finally { setLoading(false) } here - 
    // for pending audits, we need loading to stay true until polling completes
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
              <span>Audit your up to 10 pages</span>
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
        pagesAudited={progressInfo.pagesAudited}
        pagesBeingCrawled={progressInfo.pagesBeingCrawled}
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
      {!loading && auditResults && auditResults.runId && auditResults.status === 'completed' && (
        <div 
          ref={resultsRef}
          className="@container/main flex flex-1 flex-col gap-2 animate-in fade-in duration-500"
        >
          <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
            {/* Results Heading with URL */}
            {displayDomain && (
              <div className="px-4 lg:px-6">
                <h2 className="font-serif text-3xl md:text-4xl font-light tracking-tight">
                  {displayDomain}
                </h2>
              </div>
            )}
            
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
      {!loading && auditResults && auditResults.runId && auditResults.status === 'completed' && !isLoading && (testEmptyState || tableRows.length === 0) && (
        <EmptyAuditState 
          pagesAudited={testEmptyState ? 5 : (auditResults.meta?.pagesAudited ?? auditResults.pagesAudited ?? undefined)}
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
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">© 2025 Fortress. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}