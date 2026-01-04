// fortress v1
"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, FileText, ExternalLink, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, CheckCircle2, Download, FileJson, FileType, Clock } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"

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
  const [scheduledAudits, setScheduledAudits] = useState<any[]>([])
  const [scheduledAuditsLoading, setScheduledAuditsLoading] = useState(false)
  const [startingAudit, setStartingAudit] = useState(false)
  const [rerunningAuditId, setRerunningAuditId] = useState<string | null>(null)
  
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

  // Listen for domain changes from domain switcher
  useEffect(() => {
    const handleDomainChanged = () => {
      const newDomain = localStorage.getItem('selectedDomain')
      console.log('[Dashboard] Domain changed to:', newDomain)
      setSelectedDomain(newDomain)
    }
    
    // Listen for delete domain request
    const handleRequestDeleteDomain = (e: Event) => {
      const customEvent = e as CustomEvent<{ domain: string }>
      const domainToDelete = customEvent.detail?.domain
      if (domainToDelete) {
        console.log('[Dashboard] Delete domain requested:', domainToDelete)
        setDomainToDelete(domainToDelete)
        setShowDeleteDialog(true)
      }
    }
    
    window.addEventListener('domainChanged', handleDomainChanged)
    window.addEventListener('requestDeleteDomain', handleRequestDeleteDomain as EventListener)
    
    return () => {
      window.removeEventListener('domainChanged', handleDomainChanged)
      window.removeEventListener('requestDeleteDomain', handleRequestDeleteDomain as EventListener)
    }
  }, [])

  // Track if this is the initial load to avoid double-loading
  const isInitialLoad = useRef(true)
  
  // Reload data when selected domain changes (but not on initial load)
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }
    
    if (selectedDomain && authToken) {
      console.log('[Dashboard] Reloading data for domain:', selectedDomain)
      const reloadData = async () => {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await Promise.all([
            loadAudits(session.access_token, selectedDomain),
            loadHealthScore(session.access_token)
          ])
          // Also reload usage info for the new domain
          try {
            const url = `/api/audit/usage?domain=${encodeURIComponent(selectedDomain)}`
            const response = await fetch(url, {
              headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            if (response.ok) {
              const data = await response.json()
              setUsageInfo(data)
            }
          } catch (error) {
            console.error("Error loading usage info:", error)
          }
        }
      }
      reloadData()
    }
  }, [selectedDomain, authToken])

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

  // Define load functions BEFORE checkAuthAndLoad to avoid initialization order issues
  const loadAudits = useCallback(async (token: string, domain?: string | null) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46d3112f-6e93-4e4c-a7bb-bc54c7690dac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:451',message:'loadAudits called',data:{hasToken:!!token,domain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Use provided domain or fall back to selectedDomain state
      const domainToFilter = domain !== undefined ? domain : selectedDomain

      // Build query with domain filter if selected
      let query = supabase
        .from('brand_audit_runs')
        .select('*')
        .eq('user_id', user.id)
      
      if (domainToFilter) {
        query = query.eq('domain', domainToFilter)
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
  }, [selectedDomain])

  const loadHealthScore = useCallback(async (token: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46d3112f-6e93-4e4c-a7bb-bc54c7690dac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:483',message:'loadHealthScore called',data:{hasToken:!!token,selectedDomain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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
  }, [selectedDomain])

  const loadUsageInfo = useCallback(async (token: string, domain?: string | null) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46d3112f-6e93-4e4c-a7bb-bc54c7690dac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:507',message:'loadUsageInfo called',data:{hasToken:!!token,domain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      // Pass domain to get domain-specific usage
      const url = domain 
        ? `/api/audit/usage?domain=${encodeURIComponent(domain)}`
        : '/api/audit/usage'
      const response = await fetch(url, {
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
  }, [])

  // Polling removed - all audits now complete synchronously

  const checkAuthAndLoad = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/46d3112f-6e93-4e4c-a7bb-bc54c7690dac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:365',message:'checkAuthAndLoad entry',data:{loadAuditsType:typeof loadAudits,loadHealthScoreType:typeof loadHealthScore,loadUsageInfoType:typeof loadUsageInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/46d3112f-6e93-4e4c-a7bb-bc54c7690dac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:427',message:'About to call loadAudits',data:{loadAuditsType:typeof loadAudits,initialDomain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Load audits (now with domain set)
      await loadAudits(session.access_token, initialDomain)
      
      // Load health score for all authenticated users
      await loadHealthScore(session.access_token)
      
      // Load usage info for the initial domain
      await loadUsageInfo(session.access_token, initialDomain)
      
      // Load scheduled audits for paid users
      const userPlan = profile?.plan || 'free'
      if (userPlan === 'pro' || userPlan === 'enterprise') {
        await loadScheduledAudits(session.access_token)
      }
      
      // Issues are now loaded via useAuditIssues hook
    } catch (error) {
      console.error("Error loading dashboard:", error)
      setError("Failed to load dashboard. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  const handleRerunAudit = async (auditId: string, domain: string) => {
    setRerunningAuditId(auditId) // Set loading state
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

      await loadAudits(session.access_token, selectedDomain)
      
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
        title: "Unable to rerun audit",
        description: error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "error",
      })
    } finally {
      setRerunningAuditId(null) // Clear loading state
    }
  }

  const loadScheduledAudits = async (token: string) => {
    // Only load for paid users
    if (plan !== 'pro' && plan !== 'enterprise') {
      return
    }

    setScheduledAuditsLoading(true)
    try {
      const response = await fetch('/api/audit/scheduled/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setScheduledAudits(data.scheduledAudits || [])
      }
    } catch (error) {
      console.error("Error loading scheduled audits:", error)
    } finally {
      setScheduledAuditsLoading(false)
    }
  }

  const toggleAutoAudit = async (domain: string, enabled: boolean) => {
    if (!authToken) return

    try {
      const response = await fetch('/api/audit/scheduled/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ domain, enabled })
      })

      if (response.ok) {
        const data = await response.json()
        // Update local state
        setScheduledAudits((prev) => {
          const existing = prev.find(sa => sa.domain === domain)
          if (existing) {
            return prev.map(sa => sa.domain === domain ? data.scheduledAudit : sa)
          } else {
            return [...prev, data.scheduledAudit]
          }
        })
        const nextRunDate = data.scheduledAudit?.next_run 
          ? new Date(data.scheduledAudit.next_run).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })
          : null
        
        toast({
          title: enabled 
            ? `Auto weekly audits enabled for ${domain}`
            : `Auto weekly audits disabled for ${domain}`,
          description: enabled 
            ? nextRunDate 
              ? `Next audit scheduled for ${nextRunDate}.`
              : "Your domain will be audited automatically every week."
            : "Auto weekly audits have been disabled.",
        })
      } else {
        let errorMessage = 'Failed to save scheduled audit settings'
        let errorData: any = null
        
        // Check content type before parsing
        const contentType = response.headers.get('content-type')
        const isJson = contentType?.includes('application/json')
        
        try {
          if (isJson) {
            // Clone response to avoid consuming the body
            const clonedResponse = response.clone()
            errorData = await clonedResponse.json()
            // Extract error message - prioritize details (often more user-friendly), then error, then message
            if (errorData && typeof errorData === 'object') {
              const extractedMessage = errorData.details || errorData.error || errorData.message
              if (extractedMessage && typeof extractedMessage === 'string') {
                errorMessage = extractedMessage
              }
            }
          } else {
            // Try to read as text for non-JSON responses
            const clonedResponse = response.clone()
            const text = await clonedResponse.text()
            if (text && text.trim()) {
              errorMessage = text.substring(0, 200) // Limit length
            }
          }
        } catch (parseError) {
          // If parsing fails, use status text
          console.error('[ToggleAutoAudit] Failed to parse error response:', parseError)
        }
        
        // Map technical errors to user-friendly messages
        if (errorMessage.includes('PGRST205') || errorMessage.includes('schema cache') || errorMessage.includes('Could not find the table')) {
          errorMessage = 'The service is temporarily unavailable. Please try again in a moment.'
        } else if (errorMessage.includes('PGRST') || errorMessage.includes('PostgREST')) {
          errorMessage = 'A database error occurred. Please try again or contact support if the issue persists.'
        } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
          errorMessage = 'Your session has expired. Please sign in again.'
        } else if (errorMessage.includes('Forbidden') || errorMessage.includes('403')) {
          errorMessage = 'You don\'t have permission to perform this action.'
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          errorMessage = 'Too many requests. Please try again in a moment.'
        }
        
        // Log the full error for debugging (but never show raw JSON to users)
        console.error('[ToggleAutoAudit] API Error:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          error: errorData || 'No error data available'
        })
        
        // Use status text as fallback if no error message found
        if (errorMessage === 'Failed to save scheduled audit settings' && response.statusText) {
          errorMessage = 'Unable to save settings. Please try again.'
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error("Error toggling auto audit:", error)
      toast({
        title: "Unable to update auto audit settings",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
    }
  }

  const handleStartAudit = async () => {
    if (!selectedDomain || !authToken) {
      toast({
        title: "No domain selected",
        description: "Please select a domain to audit.",
      })
      return
    }

    // Check if daily limit reached
    if (usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit) {
      toast({
        title: "Daily limit reached",
        description: `You've reached your daily limit of ${usageInfo.limit} audit${usageInfo.limit === 1 ? '' : 's'}. Try again tomorrow${plan === 'free' ? ' or upgrade to Pro for 5 domains' : ''}.`,
      })
      return
    }

    // Set loading state immediately for user feedback
    setStartingAudit(true)

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ domain: selectedDomain })
      })

      // If response.ok, validation passed and audit started
      if (response.ok) {
        // Show "started" toast immediately
        toast({
          title: "Audit started",
          description: `Auditing ${selectedDomain}...`,
        })
        
        // Handle response body in background (button stays in loading state)
        ;(async () => {
          try {
            const data = await response.json()
            setStartingAudit(false)
            
            if (data.status === 'completed') {
              await Promise.all([
                loadAudits(authToken, selectedDomain),
                loadHealthScore(authToken),
                loadUsageInfo(authToken, selectedDomain),
                refetch()
              ])
              toast({
                title: "Audit completed",
                description: "Your audit results are ready.",
              })
            } else {
              toast({
                title: "Audit failed",
                description: data.error || `Audit failed with status: ${data.status || 'unknown'}`,
                variant: "error",
              })
            }
          } catch (error) {
            console.error('Error parsing audit response:', error)
            setStartingAudit(false)
            toast({
              title: "Audit failed",
              description: "Failed to parse audit response. Please check the dashboard.",
              variant: "error",
            })
          }
        })()
        
        // Return early - button stays in loading state until response is parsed
        return
      } else {
        // Validation errors - show error toast
        setStartingAudit(false)
        let errorMessage = 'Failed to start audit'
        let errorData: any = {}
        try {
          errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          errorMessage = response.statusText || errorMessage
        }
        
        toast({
          title: "Unable to start audit",
          description: errorMessage,
          variant: "error",
        })
      }
    } catch (error) {
      console.error("Error starting audit:", error)
      
      // Clear starting state on error
      setStartingAudit(false)
      
      // Extract user-friendly error message
      let errorMessage = "Failed to start audit. Please try again."
      if (error instanceof Error) {
        errorMessage = error.message
        // Map common error messages to user-friendly versions
        if (error.message.includes("Audit generation failed") || error.message.includes("generation failed")) {
          errorMessage = "The audit could not be started. This might be due to a temporary service issue. Please try again in a moment."
        } else if (error.message.includes("rate limit") || error.message.includes("429") || error.message.includes("Daily limit")) {
          // Keep the original message for rate limits as it's already user-friendly
          errorMessage = error.message
        } else if (error.message.includes("network") || error.message.includes("fetch") || error.message.includes("Network")) {
          errorMessage = "Network error. Please check your connection and try again."
        } else if (error.message.includes("Unauthorized") || error.message.includes("401")) {
          errorMessage = "Your session has expired. Please sign in again."
        } else if (error.message.includes("Forbidden") || error.message.includes("403")) {
          errorMessage = "You don't have permission to perform this action."
        }
      }
      
      toast({
        title: "Unable to start audit",
        description: errorMessage || "Please try again in a moment.",
        variant: "error",
      })
    } finally {
      // Always clear starting state in finally as a safety net
      // (should already be cleared above, but this ensures cleanup)
      setStartingAudit(false)
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

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Set loading state after validation checks
      setDeletingDomain(domainToDelete)

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

      // Close dialog immediately after successful delete so user can interact with page
      setShowDeleteDialog(false)
      setDeletingDomain(null)
      setDomainToDelete(null)

      // Reload domains first to get updated list
      await loadDomains(session.access_token)

      // If deleted domain was selected, switch to another domain or clear selection
      const { data: { user } } = await supabase.auth.getUser()
      let domainToUse = selectedDomain
      
      if (user && selectedDomain === domainToDelete) {
        // Get updated domain list
        const { data: domainData } = await supabase
          .from('brand_audit_runs')
          .select('domain')
          .eq('user_id', user.id)
          .not('domain', 'is', null)
        
        const availableDomains = Array.from(new Set(
          (domainData || []).map(a => a.domain).filter((d): d is string => d !== null)
        ))
        
        const newSelectedDomain = availableDomains[0] || null
        domainToUse = newSelectedDomain
        setSelectedDomain(newSelectedDomain)
        if (newSelectedDomain) {
          localStorage.setItem('selectedDomain', newSelectedDomain)
          window.dispatchEvent(new Event('domainChanged'))
        } else {
          localStorage.removeItem('selectedDomain')
        }
        
        // Reload data with new domain
        await loadAudits(session.access_token, newSelectedDomain)
      } else {
        // Reload data with current domain (which wasn't deleted)
        await loadAudits(session.access_token, selectedDomain)
      }
      
      // Use the correct domain (newSelectedDomain if domain was deleted, otherwise selectedDomain)
      // Wrap in try-catch to prevent one failure from blocking the rest
      try {
        await loadUsageInfo(session.access_token, domainToUse)
      } catch (error) {
        console.error('Error loading usage info after delete:', error)
      }
      
      if (plan === 'pro' || plan === 'enterprise') {
        try {
          await loadHealthScore(session.access_token)
        } catch (error) {
          console.error('Error loading health score after delete:', error)
        }
      }

      // Notify domain switcher to reload its list
      window.dispatchEvent(new Event('domainsReload'))

      toast({
        title: "Domain deleted",
        description: "All audits and data for this domain have been removed. You can now add a new domain.",
      })
    } catch (error) {
      toast({
        title: "Unable to delete domain",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
      // On error, still close dialog and clear states
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
        title: "No audit available",
        description: "Please run an audit first before exporting.",
        variant: "error",
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
        title: "Unable to export audit",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "error",
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
                  <h2 className="font-serif text-2xl font-semibold">
                    {selectedDomain || 'Content Audits'}
                  </h2>
                  <div className="flex items-center gap-3">
                    {/* Auto Audit Status for Paid Users */}
                    {(plan === 'pro' || plan === 'enterprise') && selectedDomain && (
                      <div className="flex items-center gap-2 text-sm">
                        {scheduledAuditsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (() => {
                          const scheduled = scheduledAudits.find(sa => sa.domain === selectedDomain)
                          const isEnabled = scheduled?.enabled || false
                          
                          return (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => toggleAutoAudit(selectedDomain, checked)}
                                disabled={scheduledAuditsLoading}
                              />
                              <span className="text-muted-foreground">
                                Auto weekly
                              </span>
                            </div>
                          )
                        })()}
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
                      onClick={handleStartAudit}
                      disabled={(usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit) || startingAudit}
                      variant={usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit ? "outline" : "default"}
                      className={usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit ? "opacity-70 cursor-not-allowed border-muted-foreground/50" : ""}
                    >
                      {startingAudit ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running audit...
                        </>
                      ) : usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit ? (
                        "Daily limit reached"
                      ) : (
                        "Run new audit"
                      )}
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
              disabled={deletingDomain !== null}
            >
              {deletingDomain ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}


