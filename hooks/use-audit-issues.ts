// Shared hook for fetching audit issues from database
import { useState, useEffect } from 'react'
import { transformIssuesToTableRows } from '@/lib/audit-table-adapter'
import { AuditTableRow } from '@/lib/audit-table-adapter'

interface UseAuditIssuesResult {
  tableRows: AuditTableRow[]
  loading: boolean
  error: Error | null
  totalIssues: number
}

export function useAuditIssues(auditId: string | null, token: string | null): UseAuditIssuesResult {
  const [tableRows, setTableRows] = useState<AuditTableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [totalIssues, setTotalIssues] = useState(0)

  useEffect(() => {
    if (!auditId || !token) {
      setTableRows([])
      setTotalIssues(0)
      return
    }

    const fetchIssues = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : process.env.NEXT_PUBLIC_APP_URL || ''
        
        const response = await fetch(`${baseUrl}/api/audit/${auditId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch audit')
        }
        
        const data = await response.json()
        
        // Always use issues from database (single source of truth)
        if (data.issues && data.issues.length > 0) {
          const rows = transformIssuesToTableRows(data.issues)
          // Deduplicate by ID just in case
          const uniqueRows = rows.filter((row, idx, self) => 
            idx === self.findIndex(r => r.id === row.id)
          )
          setTableRows(uniqueRows)
          setTotalIssues(data.totalIssues || uniqueRows.length)
        } else {
          setTableRows([])
          setTotalIssues(0)
        }
      } catch (err) {
        console.error("Error loading audit issues:", err)
        setError(err instanceof Error ? err : new Error('Failed to load issues'))
        setTableRows([])
        setTotalIssues(0)
      } finally {
        setLoading(false)
      }
    }

    fetchIssues()
  }, [auditId, token])

  return { tableRows, loading, error, totalIssues }
}

