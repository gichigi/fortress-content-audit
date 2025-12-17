import { useMemo } from 'react'
import { AuditTableRow } from '@/lib/audit-table-adapter'

interface HealthScoreMetrics {
  score: number
  totalActive: number
  totalCritical: number
  pagesWithIssues: number
  criticalPages: number
}

export function useHealthScoreMetrics(tableRows: AuditTableRow[]): HealthScoreMetrics {
  return useMemo(() => {
    if (!tableRows || tableRows.length === 0) {
      return {
        score: 100,
        totalActive: 0,
        totalCritical: 0,
        pagesWithIssues: 0,
        criticalPages: 0,
      }
    }

    // Only count active issues (matching table filter)
    const activeIssues = tableRows.filter(issue => (issue.status || 'active') === 'active')
    const totalActive = activeIssues.length
    const totalCritical = activeIssues.filter(issue => issue.severity === 'high').length

    // Count unique pages with issues
    const pagesSet = new Set<string>()
    const criticalPagesSet = new Set<string>()
    
    activeIssues.forEach(issue => {
      // locations array contains page URLs
      if (issue.locations && Array.isArray(issue.locations)) {
        issue.locations.forEach(loc => {
          try {
            const url = new URL(loc.url)
            const pagePath = url.pathname || '/'
            pagesSet.add(pagePath)
            
            if (issue.severity === 'high') {
              criticalPagesSet.add(pagePath)
            }
          } catch (e) {
            // Invalid URL, skip
          }
        })
      }
    })

    // Calculate health score from metrics
    const bySeverity = {
      low: activeIssues.filter(i => i.severity === 'low').length,
      medium: activeIssues.filter(i => i.severity === 'medium').length,
      high: totalCritical,
    }
    
    let score = 100
    score -= bySeverity.low * 1
    score -= bySeverity.medium * 3
    score -= bySeverity.high * 7
    score -= criticalPagesSet.size * 10
    score = Math.max(0, Math.min(100, score))

    return {
      score: Math.round(score),
      totalActive,
      totalCritical,
      pagesWithIssues: pagesSet.size,
      criticalPages: criticalPagesSet.size,
    }
  }, [tableRows])
}

