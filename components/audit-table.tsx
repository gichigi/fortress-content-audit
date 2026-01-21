// Wrapper component for AuditTable that can be used on homepage and detail page
"use client"

import { DataTable } from "@/components/data-table"
import { AuditTableRow } from "@/lib/audit-table-adapter"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"
import { useState, useEffect } from "react"

interface AuditTableProps {
  data: AuditTableRow[]
  showPreview?: boolean // If true, show first 3-5 rows with fade-out
  auditId?: string // For linking to full view
  totalIssues?: number // Total issues count (for preview text)
  hideSearch?: boolean
  hideTabs?: boolean
  readOnly?: boolean
  onStatusUpdate?: () => void
  initialSeverityFilter?: 'all' | 'critical' | 'medium' | 'low'
}

export function AuditTable({
  data,
  showPreview = false,
  auditId,
  totalIssues,
  hideSearch = false,
  hideTabs = false,
  readOnly = false,
  onStatusUpdate,
  initialSeverityFilter = 'all',
}: AuditTableProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userPlan, setUserPlan] = useState<string | undefined>(undefined)
  const [checking, setChecking] = useState(true)

  // Check authentication status and user plan
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      
      // Fetch user plan if authenticated
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', session.user.id)
          .maybeSingle()
        setUserPlan(profile?.plan || 'free')
      }
      
      setChecking(false)
    }
    checkAuth()
  }, [])

  const handleViewAll = () => {
    if (!isAuthenticated) {
      // Not authenticated, redirect to signup
      // After signup, user goes to dashboard which auto-claims the audit
      router.push(`/sign-up?next=${encodeURIComponent('/dashboard')}`)
      return
    }

    // Authenticated, go to dashboard to see all audits
    router.push('/dashboard')
  }

  // In preview mode, parent controls slicing via data prop
  // We just display what we're given
  return (
    <div className="relative">
      <DataTable
        data={data}
        auditId={auditId}
        userPlan={userPlan}
        hideSearch={hideSearch}
        hideTabs={hideTabs}
        readOnly={readOnly}
        onStatusUpdate={onStatusUpdate}
        initialSeverityFilter={initialSeverityFilter}
        hidePagination={showPreview}
        hideSelectAndActions={showPreview}
      />
      {showPreview && (totalIssues ?? data.length) > data.length && (
        <div
          className="relative -mt-48 h-48 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.98) 10%, hsl(var(--background) / 0.95) 20%, hsl(var(--background) / 0.9) 30%, hsl(var(--background) / 0.8) 40%, hsl(var(--background) / 0.65) 50%, hsl(var(--background) / 0.5) 60%, hsl(var(--background) / 0.35) 70%, hsl(var(--background) / 0.2) 80%, hsl(var(--background) / 0.1) 90%, transparent 100%)'
          }}
        />
      )}
      {showPreview && data.length > 0 && (
        <div className="flex justify-center pt-8 pb-4">
          <Button variant="default" size="lg" onClick={handleViewAll} disabled={checking} className="font-semibold shadow-md">
            {(totalIssues ?? data.length) > data.length ? (
              <>
                View all {totalIssues ?? data.length} issue{(totalIssues ?? data.length) !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                View full audit
              </>
            )}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

