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
    const totalCritical = activeIssues.filter(issue => issue.severity === 'critical').length

    // Count unique pages with issues
    const pagesSet = new Set<string>()
    const criticalPagesSet = new Set<string>()
    
    activeIssues.forEach(issue => {
      // page_url contains the page URL
      if (issue.page_url) {
        try {
          const url = new URL(issue.page_url)
          const pagePath = url.pathname || '/'
          pagesSet.add(pagePath)
          
          if (issue.severity === 'critical') {
            criticalPagesSet.add(pagePath)
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    })

    // Calculate health score from metrics (matches lib/health-score.ts: fairer calibration)
    const bySeverity = {
      low: activeIssues.filter(i => i.severity === 'low').length,
      medium: activeIssues.filter(i => i.severity === 'medium').length,
      critical: totalCritical,
    }
    
    let score = 100
    score -= bySeverity.low * 0.5
    score -= bySeverity.medium * 2
    score -= bySeverity.critical * 4
    score -= criticalPagesSet.size * 5

    // Clamp to 1-100 (minimum 1 if issues exist, matches server-side)
    score = Math.max(1, Math.min(100, score))

    return {
      score: Math.round(score),
      totalActive,
      totalCritical,
      pagesWithIssues: pagesSet.size,
      criticalPages: criticalPagesSet.size,
    }
  }, [tableRows])
}


