// fortress v1
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, FileText, ExternalLink, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, CheckCircle2, Download, FileJson, FileType } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { PLAN_NAMES } from "@/lib/plans"
import { HealthScoreChart } from "@/components/health-score-chart"
import { HealthScoreCards } from "@/components/health-score-cards"
import { AuditTable } from "@/components/audit-table"
import { useAuditIssues } from "@/hooks/use-audit-issues"
import { useHealthScoreMetrics } from "@/hooks/use-health-score-metrics"
import { createMockAuditData } from "@/lib/mock-audit-data"
import { transformIssuesToTableRows } from "@/lib/audit-table-adapter"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AuditRun {
  id: string
  domain: string | null
  title: string | null
  brand_name: string | null
  pages_scanned: number | null
  issues_json: any
  created_at: string | null
  guideline_id: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [audits, setAudits] = useState<AuditRun[]>([])
  const [plan, setPlan] = useState<string>("free")
  const [error, setError] = useState<string | null>(null)
  const [healthScoreData, setHealthScoreData] = useState<any>(null)
  const [healthScoreLoading, setHealthScoreLoading] = useState(false)
  const [usageInfo, setUsageInfo] = useState<any>(null)
  const [domains, setDomains] = useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState<string | null>(null) // Track which format is loading
  
  // Use shared hook to fetch issues from database
  const mostRecentAudit = audits.length > 0 ? audits[0] : null
  const { tableRows, loading: tableRowsLoading, totalIssues: tableTotalIssues, refetch } = useAuditIssues(
    mostRecentAudit?.id || null,
    authToken
  )

  // TEST: Force empty state via query param (remove after testing)
  const [testEmptyState, setTestEmptyState] = useState(false)
  const [testLargeAudit, setTestLargeAudit] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('testEmpty') === 'true') {
      setTestEmptyState(true)
    }
    if (params.get('testLarge') === 'true') {
      setTestLargeAudit(true)
    }
  }, [])

  // TEST: Generate large mock audit data for pagination testing (remove after testing)
  const largeMockRows = useMemo(() => {
    if (!testLargeAudit) return null
    const mockData = createMockAuditData('example.com', 150) // Generate 150 issues
    // Transform mock issues to table row format
    return mockData.issues.map((issue, idx) => ({
      id: `mock-${idx}`,
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      impact: issue.impact || '',
      fix: issue.fix || '',
      locations: issue.locations || [],
      status: 'active' as const,
    }))
  }, [testLargeAudit])

  // Use large mock data if test mode is enabled
  const displayTableRows = testLargeAudit && largeMockRows ? largeMockRows : (testEmptyState ? [] : tableRows)
  const displayTotalIssues = testLargeAudit && largeMockRows ? largeMockRows.length : (testEmptyState ? 0 : tableTotalIssues)

  // Calculate metrics using shared hook
  const metrics = useHealthScoreMetrics(displayTableRows)

  // Merge chart data with current table metrics
  const chartDataWithCurrent = useMemo(() => {
    if (!healthScoreData?.data) {
      // If no historical data, just show current score
      if (mostRecentAudit?.created_at && metrics.score !== undefined) {
        const auditDate = new Date(mostRecentAudit.created_at).toISOString().split('T')[0]
        return [{
          date: auditDate,
          score: metrics.score,
          metrics: {
            totalActive: metrics.totalActive,
            totalCritical: metrics.totalCritical,
            criticalPages: metrics.criticalPages,
            pagesWithIssues: metrics.pagesWithIssues,
          }
        }]
      }
      return []
    }

    const historicalData = [...healthScoreData.data]
    
    // Add or update current score from table data
    if (mostRecentAudit?.created_at && metrics.score !== undefined) {
      const auditDate = new Date(mostRecentAudit.created_at).toISOString().split('T')[0]
      
      // Check if we already have data for this date
      const existingIndex = historicalData.findIndex(item => item.date === auditDate)
      
      if (existingIndex >= 0) {
        // Update existing entry with current table metrics
        historicalData[existingIndex] = {
          date: auditDate,
          score: metrics.score,
          metrics: {
            totalActive: metrics.totalActive,
            totalCritical: metrics.totalCritical,
            criticalPages: metrics.criticalPages,
            pagesWithIssues: metrics.pagesWithIssues,
          }
        }
      } else {
        // Add new entry for current audit
        historicalData.push({
          date: auditDate,
          score: metrics.score,
          metrics: {
            totalActive: metrics.totalActive,
            totalCritical: metrics.totalCritical,
            criticalPages: metrics.criticalPages,
            pagesWithIssues: metrics.pagesWithIssues,
          }
        })
      }
    }
    
    // Sort by date
    return historicalData.sort((a, b) => a.date.localeCompare(b.date))
  }, [healthScoreData?.data, mostRecentAudit?.created_at, metrics])

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  // Track if this is the initial load to avoid double-loading
  const isInitialLoad = useRef(true)
  
  // Reload data when selected domain changes (but not on initial load)
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }
    
    if (selectedDomain) {
      const reloadData = async () => {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await Promise.all([
            loadAudits(session.access_token),
            loadHealthScore(session.access_token)
          ])
        }
      }
      reloadData()
    }
  }, [selectedDomain])

  useEffect(() => {
    // Check for payment success query param
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('payment') === 'success') {
      toast({
        title: "Payment successful!",
        description: "Your subscription is now active.",
      })
      // Clear query param
      router.replace('/dashboard', { scroll: false })
    }
  }, [router, toast])

  // Claim pending audit from localStorage (set during unauthenticated audit + email signup)
  const claimPendingAudit = async (token: string) => {
    try {
      // Check for direct sessionToken first (as per roadmap)
      let sessionToken: string | null = localStorage.getItem('audit_session_token')
      
      // Fallback to pendingAudit for backward compatibility
      if (!sessionToken) {
        const pendingAuditStr = localStorage.getItem('pendingAudit')
        if (pendingAuditStr) {
          try {
            const pendingAudit = JSON.parse(pendingAuditStr)
            // Check if expired (24 hours)
            if (pendingAudit.expiry && Date.now() > pendingAudit.expiry) {
              console.log('[Dashboard] Pending audit expired, clearing')
              localStorage.removeItem('pendingAudit')
              return
            }
            sessionToken = pendingAudit.sessionToken
          } catch (e) {
            console.log('[Dashboard] Failed to parse pendingAudit, clearing')
            localStorage.removeItem('pendingAudit')
            return
          }
        }
      }

      if (!sessionToken) {
        return
      }

      console.log('[Dashboard] Claiming pending audit with session token:', sessionToken)

      const response = await fetch('/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionToken })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('[Dashboard] Audit claimed successfully:', result)
        toast({
          title: "Audit saved!",
          description: `Your audit for ${result.domain || 'your site'} has been saved to your account.`
        })
      } else {
        const error = await response.json().catch(() => ({}))
        console.log('[Dashboard] Failed to claim audit:', error)
        // Don't show error to user - audit may have already been claimed or doesn't exist
      }

      // Clear both storage methods after successful claim
      localStorage.removeItem('audit_session_token')
      localStorage.removeItem('pendingAudit')
    } catch (error) {
      console.error('[Dashboard] Error claiming pending audit:', error)
      localStorage.removeItem('audit_session_token')
      localStorage.removeItem('pendingAudit')
    }
  }

  const checkAuthAndLoad = async () => {
    try {
      const supabase = createClient()
      
      // Use getUser() instead of getSession() for security (validates with server)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.log('[Dashboard] No authenticated user, redirecting to sign-up')
        router.push(`/sign-up?next=${encodeURIComponent('/dashboard')}`)
        return
      }

      // Get session for access token (needed for API calls)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('[Dashboard] No session found')
        router.push(`/sign-up?next=${encodeURIComponent('/dashboard')}`)
        return
      }

      setAuthToken(session.access_token)

      // Check for pending audit to claim (from localStorage)
      await claimPendingAudit(session.access_token)

      // Load profile to get plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (profile) {
        setPlan(profile.plan || 'free')
      }

      // Load domains first to determine selected domain
      await loadDomains(session.access_token)
      
      // Get available domains and validate saved domain
      const { data: domainData } = await supabase
        .from('brand_audit_runs')
        .select('domain')
        .eq('user_id', user.id)
        .not('domain', 'is', null)
      
      const availableDomains = Array.from(new Set(
        (domainData || []).map(a => a.domain).filter((d): d is string => d !== null)
      ))
      
      // Validate saved domain exists, otherwise use first available
      const savedDomain = localStorage.getItem('selectedDomain')
      const isValidDomain = savedDomain && availableDomains.includes(savedDomain)
      const initialDomain = isValidDomain ? savedDomain : (availableDomains[0] || null)
      
      if (initialDomain) {
        setSelectedDomain(initialDomain)
        localStorage.setItem('selectedDomain', initialDomain)
      }

      // Load audits (now with domain set)
      await loadAudits(session.access_token)
      
      // Load health score for all authenticated users
      await loadHealthScore(session.access_token)
      
      // Load usage info
      await loadUsageInfo(session.access_token)
      
      // Issues are now loaded via useAuditIssues hook
    } catch (error) {
      console.error("Error loading dashboard:", error)
      setError("Failed to load dashboard. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }


  const loadAudits = async (token: string) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Build query with domain filter if selected
      let query = supabase
        .from('brand_audit_runs')
        .select('*')
        .eq('user_id', user.id)
      
      if (selectedDomain) {
        query = query.eq('domain', selectedDomain)
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setAudits(data || [])
      
      // Issues are now loaded via useAuditIssues hook when mostRecentAudit changes
    } catch (error) {
      console.error("Error loading audits:", error)
    }
  }

  const loadHealthScore = async (token: string) => {
    // Load health score for all authenticated users
    if (!selectedDomain) {
      setHealthScoreData(null)
      return
    }
    
    setHealthScoreLoading(true)
    try {
      const response = await fetch(`/api/health-score?days=30&domain=${encodeURIComponent(selectedDomain)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        // Don't show error - health score is optional
        console.warn('[Dashboard] Failed to load health score, response not ok')
        setHealthScoreData(null)
        return
      }
      
      const data = await response.json()
      setHealthScoreData(data)
    } catch (error) {
      console.warn("Error loading health score:", error)
      setHealthScoreData(null)
    } finally {
      setHealthScoreLoading(false)
    }
  }


  const handleRerunAudit = async (auditId: string, domain: string) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/audit/${auditId}/rerun`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rerun audit')
      }

      toast({
        title: "Audit rerun",
        description: "New audit run started"
      })

      await loadAudits(session.access_token)
      
      // Reload health score after rerun
      if (plan === 'pro' || plan === 'enterprise') {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await loadHealthScore(session.access_token)
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to rerun audit",
        variant: "destructive"
      })
    }
  }

  const loadUsageInfo = async (token: string) => {
    try {
      const response = await fetch('/api/audit/usage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsageInfo(data)
      }
    } catch (error) {
      console.error("Error loading usage info:", error)
    }
  }

  const loadDomains = async (token: string) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: audits } = await supabase
        .from('brand_audit_runs')
        .select('domain')
        .eq('user_id', user.id)
        .not('domain', 'is', null)

      if (audits) {
        const uniqueDomains = Array.from(new Set(
          audits.map(a => a.domain).filter((d): d is string => d !== null)
        ))
        setDomains(uniqueDomains)
      }
    } catch (error) {
      console.error("Error loading domains:", error)
    }
  }

  const handleDeleteDomain = async () => {
    if (!domainToDelete) return

    setDeletingDomain(domainToDelete)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const encodedDomain = encodeURIComponent(domainToDelete)
      const response = await fetch(`/api/domains/${encodedDomain}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete domain')
      }

      toast({
        title: "Domain deleted",
        description: "All audits and data for this domain have been removed. You can now add a new domain.",
      })

      // Reload data
      await loadAudits(session.access_token)
      await loadUsageInfo(session.access_token)
      await loadDomains(session.access_token)
      if (plan === 'pro' || plan === 'enterprise') {
        await loadHealthScore(session.access_token)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete domain",
        variant: "destructive"
      })
    } finally {
      setDeletingDomain(null)
      setShowDeleteDialog(false)
      setDomainToDelete(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleExport = async (format: 'pdf' | 'json' | 'md') => {
    if (!mostRecentAudit?.id || !authToken) {
      toast({
        title: "Error",
        description: "No audit available to export",
        variant: "destructive"
      })
      return
    }

    setExportLoading(format)

    try {
      const response = await fetch(`/api/audit/${mostRecentAudit.id}/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        

        throw new Error(errorData.error || `Failed to export as ${format.toUpperCase()}`)
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `${mostRecentAudit.domain || 'audit'}-audit.${format}`
      if (contentDisposition) {
        // Handle both quoted and unquoted filenames
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i)
        if (filenameMatch && filenameMatch[1]) {
          // Remove quotes if present
          filename = filenameMatch[1].replace(/^["']|["']$/g, '')
        }
      }
      
      // Sanitize filename - remove any invalid characters
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export successful",
        description: `Audit exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error('[Dashboard] Export error:', error)
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export audit",
        variant: "destructive"
      })
    } finally {
      setExportLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="px-4 lg:px-6 pt-4">
            <Skeleton className="h-10 w-48 mb-4" />
          </div>
          <div className="px-4 lg:px-6 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-10 w-32" />
              </div>
              
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border border-border">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <Skeleton className="h-8 w-64" />
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="h-9 w-24" />
                          <Skeleton className="h-9 w-9" />
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // tableRows are now loaded via useAuditIssues hook
  const previousScore = healthScoreData?.data && healthScoreData.data.length > 1 
    ? healthScoreData.data[healthScoreData.data.length - 2]?.score 
    : undefined

  return (
    <>
    <div className="@container/main flex flex-1 flex-col gap-2">
            {/* Error Alert */}
            {error && (
              <div className="px-4 lg:px-6 pt-4">
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="flex items-center justify-between px-4 lg:px-6">
                  <h2 className="font-serif text-2xl font-semibold">Content Audits</h2>
                  <div className="flex items-center gap-3">
                    {usageInfo && (
                      <div className="text-sm text-muted-foreground">
                        {usageInfo.limit > 0 && (
                          <span>
                            {usageInfo.today}/{usageInfo.limit} audit{usageInfo.limit === 1 ? '' : 's'} today
                          </span>
                        )}
                        {usageInfo.domainLimit > 0 && (
                          <span className="ml-3">
                            {usageInfo.domains}/{usageInfo.domainLimit} domain{usageInfo.domainLimit === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    )}
                    {mostRecentAudit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={exportLoading !== null}
                          >
                            {exportLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Exporting {exportLoading.toUpperCase()}...
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 h-4 w-4" />
                                Export
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleExport('pdf')}
                            disabled={exportLoading !== null}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleExport('json')}
                            disabled={exportLoading !== null}
                          >
                            <FileJson className="mr-2 h-4 w-4" />
                            JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleExport('md')}
                            disabled={exportLoading !== null}
                          >
                            <FileType className="mr-2 h-4 w-4" />
                            Markdown
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button 
                      asChild
                      disabled={usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit}
                      title={
                        usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit
                          ? `Daily limit reached. Try again tomorrow${plan === 'free' ? ' or upgrade to Pro for 5 domains' : ''}.`
                          : undefined
                      }
                    >
                      <Link href="/">Rerun Audit</Link>
                    </Button>
                  </div>
                </div>


                {/* Health Score Section - Available to all authenticated users */}
                <HealthScoreCards
                  currentScore={metrics.score !== undefined ? {
                    score: metrics.score,
                    metrics: {
                      totalActive: metrics.totalActive,
                      totalCritical: metrics.totalCritical,
                      pagesWithIssues: metrics.pagesWithIssues,
                      criticalPages: metrics.criticalPages,
                    }
                  } : healthScoreData?.currentScore}
                  previousScore={previousScore}
                  loading={tableRowsLoading || healthScoreLoading}
                />

                {/* Health Score Chart - Show if we have data (historical or current) */}
                {(chartDataWithCurrent.length > 0 || healthScoreData) && (
                  <div className="px-4 lg:px-6">
                    <HealthScoreChart 
                      data={chartDataWithCurrent.length > 0 ? chartDataWithCurrent : (healthScoreData?.data || [])} 
                      domain={healthScoreData?.domain || selectedDomain || undefined}
                    />
                  </div>
                )}

                {/* Audit Issues Table - Show most recent audit's issues */}
                {audits.length === 0 ? (
                  <div className="px-4 lg:px-6">
                    <Card className="border-2 border-dashed border-border">
                      <CardContent className="pt-6">
                        <div className="text-center py-12 px-4">
                          <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                          <h3 className="font-serif text-2xl sm:text-3xl font-semibold mb-3">
                            Welcome! Get started with your first audit
                          </h3>
                          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-2 max-w-xl mx-auto">
                            Run a content audit to discover issues across your website. We'll scan your pages and identify typos, grammar errors, inconsistencies, and more.
                          </p>
                          <p className="text-sm text-muted-foreground mb-6">
                            Your audit results will appear here once complete.
                          </p>
                          <Button asChild size="lg" className="font-semibold">
                            <Link href="/">Run Your First Audit</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="px-4 lg:px-6">
                    <AuditTable
                      data={displayTableRows}
                      auditId={mostRecentAudit?.id}
                      totalIssues={displayTotalIssues}
                      onStatusUpdate={refetch}
                    />
                  </div>
                )}
            </div>
          </div>

      {/* Domain Deletion Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all audits and data for <strong>{domainToDelete}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDomain}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

