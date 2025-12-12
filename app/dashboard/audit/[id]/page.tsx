"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, RefreshCw, Clock, Download } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { AuditResults } from "@/components/AuditResults"
import Header from "@/components/Header"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AuditDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [audit, setAudit] = useState<any>(null)
  const [polling, setPolling] = useState(false)
  const [progress, setProgress] = useState<{ pagesScanned: number; issuesFound: number } | null>(null)
  const [plan, setPlan] = useState<string>('free')
  const [exporting, setExporting] = useState(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    loadAudit()
    return () => {
      // Cleanup polling on unmount
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const loadAudit = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/sign-up')
        return
      }

      // Get user plan
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle()
        if (profile) {
          setPlan(profile.plan || 'free')
        }
      } else {
        setPlan('free')
      }

      const response = await fetch(`/api/audit/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load audit')
      }

      const data = await response.json()
      
      // Check if audit is in progress and needs polling
      if (data.status === 'in_progress' && data.responseId) {
        setPolling(true)
        startPolling(data.responseId, data.runId, session.access_token)
      }
      
      // Transform data to match what AuditResults expects
      // API returns { groups: [], meta: {}, domain: ... }
      // AuditResults expects { groups: [], meta: {}, totalIssues: number, preview: boolean }
      
      const formattedData = {
        ...data,
        totalIssues: data.groups?.length || 0,
        // Ensure preview is respected based on what API returns
        preview: data.preview
      }

      setAudit(formattedData)
    } catch (error) {
      console.error('Error loading audit:', error)
      toast({
        title: "Error",
        description: "Failed to load audit details",
        variant: "destructive"
      })
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const startPolling = (responseId: string, runId: string | null, token: string) => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    // Poll immediately
    pollAuditStatus(responseId, runId, token)

    // Then poll every 5 seconds
    pollIntervalRef.current = setInterval(() => {
      pollAuditStatus(responseId, runId, token)
    }, 5000)
  }

  const pollAuditStatus = async (responseId: string, runId: string | null, token: string) => {
    try {
      const response = await fetch('/api/audit/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ responseId, runId })
      })

      if (!response.ok) {
        throw new Error('Failed to poll audit status')
      }

      const data = await response.json()

      if (data.status === 'in_progress') {
        // Update progress info
        if (data.progress) {
          setProgress({
            pagesScanned: data.progress.pagesScanned || 0,
            issuesFound: data.progress.issuesFound || 0,
          })
        }
      } else if (data.status === 'completed') {
        // Audit completed, stop polling and reload
        setPolling(false)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        setProgress(null)
        // Reload audit to show results
        await loadAudit()
        toast({
          title: "Audit completed",
          description: "Your audit has finished processing.",
        })
      }
    } catch (error) {
      console.error('Error polling audit status:', error)
      // Don't show error to user, just log it
    }
  }

  const handleRerun = async () => {
    if (!audit?.domain) return
    
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/audit/${params.id}/rerun`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to rerun audit')
      }

      toast({
        title: "Audit started",
        description: "New audit is running..."
      })
      
      // Reload or redirect
      // Ideally wait for it to finish or poll, but for now just reload
      await loadAudit()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rerun audit",
        variant: "destructive"
      })
      setLoading(false)
    }
  }

  const handleResume = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/audit/${params.id}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resume audit')
      }

      const data = await response.json()

      if (data.status === 'in_progress') {
        toast({
          title: "Audit resumed",
          description: "Polling for status updates..."
        })
        // Start polling if we have responseId
        if (data.responseId) {
          setPolling(true)
          startPolling(data.responseId, params.id as string, session.access_token)
        }
      } else if (data.status === 'completed') {
        toast({
          title: "Audit completed",
          description: "Your audit has finished processing."
        })
        await loadAudit()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resume audit",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Check if audit can be resumed (has responseId in issues_json but status is not in_progress)
  const canResume = audit && !polling && audit.issues_json?.responseId && audit.status !== 'in_progress' && !audit.groups?.length

  // Check if user can export (paid users only)
  const canExport = plan === 'pro' || plan === 'paid' || plan === 'enterprise'

  const handleExport = async (format: 'pdf' | 'json' | 'md') => {
    if (!canExport) {
      toast({
        title: "Upgrade required",
        description: "Export functionality requires a paid plan. Please upgrade to export audit results.",
        variant: "destructive"
      })
      router.push('/account')
      return
    }

    try {
      setExporting(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/audit/${params.id}/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.upgradeRequired) {
          toast({
            title: "Upgrade required",
            description: error.error,
            variant: "destructive"
          })
          router.push('/account')
          return
        }
        throw new Error(error.error || 'Failed to export audit')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `audit-${Date.now()}.${format}`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

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
        description: `Your audit has been exported as ${format.toUpperCase()}.`
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export audit",
        variant: "destructive"
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="font-serif text-2xl font-medium">
              {audit?.title || audit?.brand_name || audit?.domain || 'Audit Details'}
            </h1>
          </div>
          <div className="flex gap-2">
            {canResume && (
              <Button variant="outline" size="sm" onClick={handleResume}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Resume Audit
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRerun}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rerun Audit
            </Button>
            {canExport && audit && !polling && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? 'Exporting...' : 'Export'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('md')}>
                    Export as Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Progress indicator for in-progress audits */}
        {polling && (
          <Card className="mb-8 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Audit in progress
                  </h3>
                  {progress && (
                    <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      {progress.pagesScanned > 0 && (
                        <p>Pages scanned: {progress.pagesScanned}</p>
                      )}
                      {progress.issuesFound > 0 && (
                        <p>Issues found so far: {progress.issuesFound}</p>
                      )}
                    </div>
                  )}
                  {!progress && (
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Processing your audit...
                    </p>
                  )}
                </div>
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
        )}

        {audit && !polling && (
          <AuditResults 
            results={audit} 
            isAuthenticated={true} 
          />
        )}
      </div>
    </div>
  )
}
