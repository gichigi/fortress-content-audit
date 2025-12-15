// fortress v1
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, FileText, Copy, Trash2, ExternalLink, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import Header from "@/components/Header"
import { PLAN_NAMES } from "@/lib/plans"
import posthog from "posthog-js"
import { HealthScoreChart } from "@/components/health-score-chart"
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

interface Guideline {
  id: string
  title: string | null
  created_at: string | null
  last_modified: string | null
}

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
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [audits, setAudits] = useState<AuditRun[]>([])
  const [plan, setPlan] = useState<string>("free")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [healthScoreData, setHealthScoreData] = useState<any>(null)
  const [healthScoreLoading, setHealthScoreLoading] = useState(false)
  const [usageInfo, setUsageInfo] = useState<any>(null)
  const [domains, setDomains] = useState<string[]>([])
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null)

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

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

      // Load guidelines and audits
      await Promise.all([
        loadGuidelines(session.access_token),
        loadAudits(session.access_token)
      ])
      
      // Load health score after plan is set
      if (profile && (profile.plan === 'pro' || profile.plan === 'enterprise')) {
        await loadHealthScore(session.access_token)
      }
      
      // Load usage info and domains
      await loadUsageInfo(session.access_token)
      await loadDomains(session.access_token)
    } catch (error) {
      console.error("Error loading dashboard:", error)
      setError("Failed to load dashboard. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  const loadGuidelines = async (token: string) => {
    try {
      const response = await fetch('/api/guidelines?mode=list&limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to load guidelines')
      const data = await response.json()
      setGuidelines(data.guidelines || [])
    } catch (error) {
      console.error("Error loading guidelines:", error)
    }
  }

  const loadAudits = async (token: string) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('brand_audit_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setAudits(data || [])
    } catch (error) {
      console.error("Error loading audits:", error)
    }
  }

  const loadHealthScore = async (token: string) => {
    // Only load health score for paid users
    if (plan === 'free') return
    
    setHealthScoreLoading(true)
    try {
      const response = await fetch('/api/health-score?days=30', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        // Don't show error - health score is optional
        console.error('[Dashboard] Failed to load health score')
        return
      }
      
      const data = await response.json()
      setHealthScoreData(data)
    } catch (error) {
      console.error("Error loading health score:", error)
    } finally {
      setHealthScoreLoading(false)
    }
  }

  const handleDuplicate = async (guidelineId: string) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/guidelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ duplicateFromId: guidelineId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to duplicate')
      }

      toast({
        title: "Duplicated",
        description: "Guideline duplicated successfully"
      })

      await loadGuidelines(session.access_token)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to duplicate guideline",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (guidelineId: string) => {
    if (!confirm("Are you sure you want to delete this guideline?")) return

    setDeletingId(guidelineId)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/guidelines/${guidelineId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast({
        title: "Deleted",
        description: "Guideline deleted successfully"
      })

      await loadGuidelines(session.access_token)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete guideline",
        variant: "destructive"
      })
    } finally {
      setDeletingId(null)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-16 max-w-5xl">
          <div className="mb-12">
            <Skeleton className="h-4 w-16 mb-6" />
            <Skeleton className="h-16 w-96 mb-4" />
            <Skeleton className="h-6 w-96 max-w-2xl" />
          </div>
          
          <div className="space-y-8">
            <Tabs defaultValue="audit" className="space-y-8">
              <TabsList>
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32 ml-2" />
              </TabsList>
              
              <TabsContent value="audit" className="space-y-4">
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
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-16 max-w-5xl">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
          <h1 className="font-serif text-5xl md:text-6xl font-light tracking-tight mb-4">
            Dashboard
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
            Audit your website content and manage your guidelines
          </p>
        </div>

        <Tabs defaultValue="audit" className="space-y-8" onValueChange={(value) => {
          if (value === 'audit') {
            try {
              posthog.capture('audit_viewed', {
                audit_count: audits.length,
                plan: plan
              })
            } catch {}
          }
        }}>
          <TabsList>
            <TabsTrigger value="audit">Audit</TabsTrigger>
            <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
          </TabsList>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="guidelines" className="space-y-4">
            {guidelines.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-serif text-2xl font-semibold mb-2">No guidelines yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Create your first brand voice guideline to get started
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/start">Create Audit</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                      Note: Guidelines feature is currently deprioritized in favor of content audits
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {guidelines.map((guideline) => (
                  <Card key={guideline.id} className="border border-border">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="font-serif text-2xl font-semibold mb-2">
                            {guideline.title || "Untitled"}
                          </CardTitle>
                          <CardDescription>
                            Last modified {formatDate(guideline.last_modified)}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/guidelines/${guideline.id}`}>
                              Open
                            </Link>
                          </Button>
                          {plan === 'pro' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicate(guideline.id)}
                              disabled={deletingId === guideline.id}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(guideline.id)}
                            disabled={deletingId === guideline.id}
                          >
                            {deletingId === guideline.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
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
                <Button 
                  asChild
                  disabled={usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit}
                  title={
                    usageInfo && usageInfo.limit > 0 && usageInfo.today >= usageInfo.limit
                      ? `Daily limit reached. Try again tomorrow${plan === 'free' ? ' or upgrade to Pro for 5 domains' : ''}.`
                      : undefined
                  }
                >
                  <Link href="/">Run New Audit</Link>
                </Button>
              </div>
            </div>

            {/* Domain Management Section */}
            {domains.length > 0 && (
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle className="font-serif text-xl font-semibold">Your Domains</CardTitle>
                  <CardDescription>
                    Manage your audited domains. Delete a domain to free up a slot for a new one.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {domains.map((domain) => (
                      <div key={domain} className="flex items-center justify-between py-2 px-3 rounded-md border border-border">
                        <span className="text-sm font-medium">{domain}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDomainToDelete(domain)
                            setShowDeleteDialog(true)
                          }}
                          disabled={deletingDomain === domain}
                        >
                          {deletingDomain === domain ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Health Score Section - Only for paid users */}
            {plan !== 'free' && (
              <div className="space-y-6 mb-8">
                {/* Large Health Score Card */}
                {healthScoreLoading ? (
                  <Card className="border border-border">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ) : healthScoreData?.currentScore ? (
                  <>
                    <Card className="border border-border">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardDescription className="mb-2">Current Health Score</CardDescription>
                            <div className="flex items-baseline gap-3">
                              <span className={`font-serif text-6xl font-light ${
                                healthScoreData.currentScore.score >= 80 ? 'text-green-600' :
                                healthScoreData.currentScore.score >= 50 ? 'text-yellow-600' :
                                'text-destructive'
                              }`}>
                                {Math.round(healthScoreData.currentScore.score)}
                              </span>
                              <span className="text-2xl text-muted-foreground">/100</span>
                              {healthScoreData.data && healthScoreData.data.length > 1 && (
                                <div className="flex items-center gap-1 ml-4">
                                  {(() => {
                                    const current = healthScoreData.currentScore.score
                                    const previous = healthScoreData.data[healthScoreData.data.length - 2]?.score || current
                                    const diff = current - previous
                                    if (diff > 0) {
                                      return <TrendingUp className="h-5 w-5 text-green-600" />
                                    } else if (diff < 0) {
                                      return <TrendingDown className="h-5 w-5 text-destructive" />
                                    } else {
                                      return <Minus className="h-5 w-5 text-muted-foreground" />
                                    }
                                  })()}
                                  <span className="text-sm text-muted-foreground">
                                    {(() => {
                                      const current = healthScoreData.currentScore.score
                                      const previous = healthScoreData.data[healthScoreData.data.length - 2]?.score || current
                                      const diff = current - previous
                                      if (diff > 0) return `+${diff.toFixed(0)}`
                                      if (diff < 0) return diff.toFixed(0)
                                      return '0'
                                    })()}
                                  </span>
                                </div>
                              )}
                            </div>
                            {healthScoreData.domain && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {healthScoreData.domain}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Health Score Chart */}
                    <HealthScoreChart 
                      data={healthScoreData.data || []} 
                      domain={healthScoreData.domain}
                    />

                    {/* Supporting Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="border border-border">
                        <CardHeader className="pb-2">
                          <CardDescription>Total Active Issues</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-light">
                            {healthScoreData.currentScore.metrics?.totalActive || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border border-border">
                        <CardHeader className="pb-2">
                          <CardDescription>Total Critical Issues</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-light text-destructive">
                            {healthScoreData.currentScore.metrics?.totalCritical || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border border-border">
                        <CardHeader className="pb-2">
                          <CardDescription>Pages with Issues</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-light">
                            {healthScoreData.currentScore.metrics?.pagesWithIssues || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border border-border">
                        <CardHeader className="pb-2">
                          <CardDescription>Critical Pages</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-light text-destructive">
                            {healthScoreData.currentScore.metrics?.criticalPages || 0}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                ) : (
                  <Card className="border border-border">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          No health score data available. Run an audit to see your content quality score.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            
            {audits.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-serif text-2xl font-semibold mb-2">No audits yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Run your first content audit to get started
                    </p>
                    <Button asChild>
                      <Link href="/">Run Audit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {audits.map((audit) => {
                  const issues = audit.issues_json?.groups || []
                  const gatedIssues = plan === 'free' ? issues.slice(0, 5) : issues
                  const highIssues = issues.filter((i: any) => i.severity === 'high').length
                  const mediumIssues = issues.filter((i: any) => i.severity === 'medium').length
                  const lowIssues = issues.filter((i: any) => i.severity === 'low').length
                  
                  return (
                    <Card key={audit.id} className="border border-border">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="font-serif text-2xl font-semibold mb-2">
                              {audit.title || audit.brand_name || audit.domain || "Audit"}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-4">
                              <span>{audit.domain}</span>
                              <span>•</span>
                              <span>{audit.pages_scanned} pages scanned</span>
                              <span>•</span>
                              <span className="font-medium">{issues.length} issues found</span>
                              {(highIssues > 0 || mediumIssues > 0 || lowIssues > 0) && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-2">
                                    {highIssues > 0 && <span className="text-destructive">{highIssues} high</span>}
                                    {mediumIssues > 0 && <span className="text-yellow-600">{mediumIssues} medium</span>}
                                    {lowIssues > 0 && <span className="text-muted-foreground">{lowIssues} low</span>}
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span>{formatDate(audit.created_at)}</span>
                            </CardDescription>
                          </div>
                          {plan === 'pro' && audit.domain && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRerunAudit(audit.id, audit.domain!)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Re-run
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {gatedIssues.length === 0 ? (
                          <p className="text-muted-foreground">No issues found</p>
                        ) : (
                          <div className="space-y-4">
                            {plan === 'free' && issues.length > 5 && (
                              <div className="border border-border p-4 bg-muted/50 mb-4">
                                <p className="text-sm text-muted-foreground">
                                  Showing 5 of {issues.length} issues.{' '}
                                  <Button 
                                    variant="link" 
                                    className="p-0 h-auto text-sm font-medium"
                                    onClick={async () => {
                                      try { 
                                        posthog.capture('upgrade_clicked', { location: 'audit-gating' }) 
                                      } catch {}
                                      
                                      // Call checkout API directly
                                      try {
                                        const supabase = createClient()
                                        const { data: { session } } = await supabase.auth.getSession()
                                        
                                        if (!session) {
                                          router.push(`/sign-up?next=${encodeURIComponent('/dashboard')}`)
                                          return
                                        }

                                        const response = await fetch('/api/create-checkout-session', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${session.access_token}`,
                                          },
                                          body: JSON.stringify({}),
                                        })

                                        if (!response.ok) {
                                          const error = await response.json()
                                          throw new Error(error.error || 'Failed to create checkout session')
                                        }

                                        const { url } = await response.json()
                                        if (url) {
                                          window.location.href = url
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: error instanceof Error ? error.message : "Failed to start checkout",
                                          variant: "destructive",
                                        })
                                      }
                                    }}
                                  >
                                    Upgrade to {PLAN_NAMES.pro}
                                  </Button>{' '}
                                  to see all issues and unlock unlimited audits.
                                </p>
                              </div>
                            )}
                            
                            {/* Summary view: just show top 3 issues as a teaser */}
                            {gatedIssues.slice(0, 3).map((issue: any, idx: number) => (
                              <div key={idx} className="border-l-2 border-border pl-4 py-2 opacity-80">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`h-2 w-2 rounded-full ${
                                    issue.severity === 'high' ? 'bg-destructive' :
                                    issue.severity === 'medium' ? 'bg-yellow-500' :
                                    'bg-muted'
                                  }`} />
                                  <h4 className="font-medium text-sm truncate">{issue.title || `Issue ${idx + 1}`}</h4>
                                </div>
                              </div>
                            ))}
                            
                            {gatedIssues.length > 3 && (
                              <p className="text-xs text-muted-foreground pl-6">
                                + {gatedIssues.length - 3} more issues...
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

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
      </main>
    </div>
  )
}

