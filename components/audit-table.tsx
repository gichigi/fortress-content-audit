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

  const previewRows = showPreview ? data.slice(0, 5) : data
  const remainingCount = showPreview && data.length > 5 ? data.length - 5 : 0

  return (
    <div className="relative">
      <DataTable 
        data={previewRows} 
        auditId={auditId}
        userPlan={userPlan}
        hideSearch={hideSearch}
        hideTabs={hideTabs}
        readOnly={readOnly}
        onStatusUpdate={onStatusUpdate}
      />
      {showPreview && remainingCount > 0 && (
        <div className="relative -mt-24 h-24 bg-gradient-to-t from-background via-background to-transparent pointer-events-none" />
      )}
      {showPreview && remainingCount > 0 && (
        <div className="flex justify-center pt-8 pb-4">
          <Button variant="outline" onClick={handleViewAll} disabled={checking}>
            View all {totalIssues ?? data.length} issue{(totalIssues ?? data.length) !== 1 ? 's' : ''}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
      {showPreview && remainingCount === 0 && data.length > 0 && (
        <div className="flex justify-center pt-8 pb-4">
          <Button variant="outline" onClick={handleViewAll} disabled={checking}>
            View full audit
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

