// fortress v1
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ArrowLeft, FileText, Copy, Trash2, ExternalLink, RefreshCw, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Header from "@/components/Header"
import { PLAN_NAMES } from "@/lib/plans"
import posthog from "posthog-js"

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

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

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
    } catch (error) {
      console.error("Error loading dashboard:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard",
        variant: "destructive"
      })
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
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to rerun audit",
        variant: "destructive"
      })
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
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <Button asChild>
                <Link href="/">Run New Audit</Link>
              </Button>
            </div>
            
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
                          <div className="flex gap-2">
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
                            <Button asChild size="sm">
                              <Link href={`/dashboard/audit/${audit.id}`}>
                                View Details
                              </Link>
                            </Button>
                          </div>
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
                                      
                                      // Redirect to upgrade flow
                                      router.push('/account')
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
      </main>
    </div>
  )
}

