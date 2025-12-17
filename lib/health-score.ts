import { AuditRun } from "@/types/fortress"
import { supabaseAdmin } from "./supabase-admin"
import { Issue } from "@/types/fortress"

/**
 * Health score calculation result
 */
export interface HealthScoreResult {
  score: number // 0-100
  metrics: {
    totalActive: number
    totalCritical: number // high-severity issues
    bySeverity: {
      low: number
      medium: number
      high: number
    }
    criticalPages: number
    pagesWithIssues: number
  }
}

/**
 * Calculate health score for a single audit
 * 
 * Formula: 100 - (low×1 + medium×3 + high×7) - (criticalPages×10)
 * - Excludes ignored/resolved issues (only counts active)
 * - Critical pages = pages with at least one high-severity issue
 * - Score clamped to 0-100
 * - Counts issues, not instances
 * 
 * @param audit - Audit run (issues queried from issues table)
 * @returns Health score result with metrics
 */
export async function calculateHealthScore(
  audit: AuditRun
): Promise<HealthScoreResult> {
  // Query issues from issues table (only active issues)
  const { data: issuesData, error } = await (supabaseAdmin as any)
    .from('issues')
    .select('severity, status, locations')
    .eq('audit_id', audit.id)
    .eq('status', 'active')  // Only active issues

  if (error) {
    console.error('[HealthScore] Error fetching issues:', error)
    throw error
  }

  const issues: Issue[] = (issuesData || []) as Issue[]

  // If no issues found, return empty score
  if (!issues || issues.length === 0) {
    return {
      score: 100,
      metrics: {
        totalActive: 0,
        totalCritical: 0,
        bySeverity: { low: 0, medium: 0, high: 0 },
        criticalPages: 0,
        pagesWithIssues: 0,
      },
    }
  }

  // Count issues by severity
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
  }
  
  // Track unique pages with issues
  const pagesWithIssuesSet = new Set<string>()
  
  // Track unique critical pages (pages with high-severity issues)
  const criticalPagesSet = new Set<string>()
  
  issues.forEach((issue: Issue) => {
    // Count by severity
    bySeverity[issue.severity]++
    
    // Extract unique pages from locations array
    if (issue.locations && Array.isArray(issue.locations)) {
      issue.locations.forEach((loc: { url: string }) => {
        try {
          const url = new URL(loc.url)
          const pagePath = url.pathname || '/'
          pagesWithIssuesSet.add(pagePath)
          
          // If high severity, mark page as critical
          if (issue.severity === 'high') {
            criticalPagesSet.add(pagePath)
          }
        } catch (e) {
          console.warn('[HealthScore] Invalid URL in locations:', loc.url)
        }
      })
    }
  })
  
  const totalActive = issues.length
  const totalCritical = bySeverity.high
  const criticalPages = criticalPagesSet.size
  const pagesWithIssues = pagesWithIssuesSet.size
  
  // Apply formula: 100 - (low×1 + medium×3 + high×7) - (criticalPages×10)
  let score = 100
  score -= bySeverity.low * 1
  score -= bySeverity.medium * 3
  score -= bySeverity.high * 7
  score -= criticalPages * 10
  
  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    metrics: {
      totalActive,
      totalCritical,
      bySeverity,
      criticalPages,
      pagesWithIssues,
    },
  }
}

// Removed: calculateHealthScoreFromGroups - no longer needed with simplified model

/**
 * Calculate health score for multiple audits (aggregated)
 * 
 * This aggregates metrics across multiple audits for a domain.
 * Useful for calculating overall health score across audit history.
 * Counts issues, not instances.
 * 
 * @param audits - Array of audit runs
 * @returns Aggregated health score result
 */
export async function calculateAggregatedHealthScore(
  audits: AuditRun[]
): Promise<HealthScoreResult> {
  // Aggregate metrics across all audits
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
  }
  
  const pagesWithIssuesSet = new Set<string>()
  const criticalPagesSet = new Set<string>()
  
  // Query all issues for all audits (only active)
  const auditIds = audits.map(a => a.id)
  
  const { data: allIssues, error } = await (supabaseAdmin as any)
    .from('issues')
    .select('severity, status, locations')
    .in('audit_id', auditIds)
    .eq('status', 'active')

  if (error) {
    console.error('[HealthScore] Error fetching issues:', error)
    throw error
  }

  // If no issues found, return empty score
  if (!allIssues || allIssues.length === 0) {
    return {
      score: 100,
      metrics: {
        totalActive: 0,
        totalCritical: 0,
        bySeverity: { low: 0, medium: 0, high: 0 },
        criticalPages: 0,
        pagesWithIssues: 0,
      },
    }
  }

  // Process issues
  (allIssues || []).forEach((issue: Issue) => {
    // Count by severity
    bySeverity[issue.severity]++
    
    // Extract unique pages from locations array
    if (issue.locations && Array.isArray(issue.locations)) {
      issue.locations.forEach((loc: { url: string }) => {
        try {
          const url = new URL(loc.url)
          const pagePath = url.pathname || '/'
          pagesWithIssuesSet.add(pagePath)
          
          if (issue.severity === 'high') {
            criticalPagesSet.add(pagePath)
          }
        } catch (e) {
          console.warn('[HealthScore] Invalid URL in locations:', loc.url)
        }
      })
    }
  })
  
  const totalActive = allIssues.length
  const totalCritical = bySeverity.high
  const criticalPages = criticalPagesSet.size
  const pagesWithIssues = pagesWithIssuesSet.size
  
  // Apply formula
  let score = 100
  score -= bySeverity.low * 1
  score -= bySeverity.medium * 3
  score -= bySeverity.high * 7
  score -= criticalPages * 10
  
  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    metrics: {
      totalActive,
      totalCritical,
      bySeverity,
      criticalPages,
      pagesWithIssues,
    },
  }
}

// Removed: calculateAggregatedHealthScoreFromGroups - no longer needed with simplified model

