// Shared hook for fetching audit issues from database
import { useState, useEffect, useCallback } from 'react'
import { transformIssuesToTableRows } from '@/lib/audit-table-adapter'
import { AuditTableRow } from '@/lib/audit-table-adapter'

interface UseAuditIssuesResult {
  tableRows: AuditTableRow[]
  loading: boolean
  error: Error | null
  totalIssues: number
  refetch: () => Promise<void>
}

export function useAuditIssues(auditId: string | null, token: string | null): UseAuditIssuesResult {
  const [tableRows, setTableRows] = useState<AuditTableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [totalIssues, setTotalIssues] = useState(0)

  const fetchIssues = useCallback(async () => {
    if (!auditId || !token) {
      setTableRows([])
      setTotalIssues(0)
      return
    }

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
        // Handle 404 (audit not found/deleted) gracefully
        if (response.status === 404) {
          setTableRows([])
          setTotalIssues(0)
          setError(null) // Clear any previous errors
          setLoading(false)
          return
        }
        // Handle 401 (authentication error) with specific message
        if (response.status === 401) {
          let errorMessage = 'Your session has expired. Please sign in again.'
          try {
            const errorData = await response.json()
            if (errorData.error) {
              errorMessage = errorData.error
            }
          } catch {
            // If JSON parsing fails, use default message
          }
          setError(new Error(errorMessage))
          setTableRows([])
          setTotalIssues(0)
          setLoading(false)
          return
        }
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
  }, [auditId, token])

  useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  return { tableRows, loading, error, totalIssues, refetch: fetchIssues }
}


