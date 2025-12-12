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
}

export function AuditTable({
  data,
  showPreview = false,
  auditId,
  totalIssues,
}: AuditTableProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      setChecking(false)
    }
    checkAuth()
  }, [])

  const handleViewAll = () => {
    if (!auditId) {
      // No audit ID, just go to dashboard
      router.push('/dashboard')
      return
    }

    if (!isAuthenticated) {
      // Not authenticated, redirect to signup
      // After signup, user goes to dashboard which auto-claims the audit
      // Then they can click the audit from dashboard list, or we can improve this later
      router.push(`/sign-up?next=${encodeURIComponent('/dashboard')}`)
      return
    }

    // Authenticated, go directly to audit detail
    router.push(`/dashboard/audit/${auditId}`)
  }

  const previewRows = showPreview ? data.slice(0, 5) : data
  const remainingCount = showPreview && data.length > 5 ? data.length - 5 : 0

  return (
    <div className="relative">
      <DataTable data={previewRows} />
      {showPreview && remainingCount > 0 && (
        <div className="relative -mt-24 h-24 bg-gradient-to-t from-background via-background to-transparent pointer-events-none" />
      )}
      {showPreview && remainingCount > 0 && (
        <div className="flex justify-center pt-8 pb-4">
          <Button variant="outline" onClick={handleViewAll} disabled={checking}>
            View all {totalIssues || data.length} issues
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

