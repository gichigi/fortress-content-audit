import { AuditRun } from "@/types/fortress"
import { AuditIssueGroup } from "./audit-table-adapter"
import { generateIssueSignature } from "./issue-signature"
import { IssueState } from "@/types/fortress"

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
 * - Excludes ignored issues
 * - Critical pages = pages with at least one high-severity issue
 * - Score clamped to 0-100
 * 
 * @param audit - Audit run with issues_json
 * @param ignoredSignatures - Set of ignored issue signatures
 * @returns Health score result with metrics
 */
export function calculateHealthScore(
  audit: AuditRun,
  ignoredSignatures: Set<string>
): HealthScoreResult {
  // Extract issues from audit
  const issuesJson = audit.issues_json as any
  const groups = Array.isArray(issuesJson?.groups) ? issuesJson.groups : []
  
  // Filter out ignored issues
  const activeGroups = groups.filter((group: AuditIssueGroup) => {
    const signature = generateIssueSignature(group)
    return !ignoredSignatures.has(signature)
  })
  
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
  
  activeGroups.forEach((group: AuditIssueGroup) => {
    // Count by severity
    if (group.severity === 'low') bySeverity.low++
    else if (group.severity === 'medium') bySeverity.medium++
    else if (group.severity === 'high') bySeverity.high++
    
    // Extract unique page URLs from examples
    if (group.examples && Array.isArray(group.examples)) {
      group.examples.forEach((example) => {
        if (example.url) {
          try {
            // Extract page path from URL for consistency
            const url = new URL(example.url)
            const pagePath = url.pathname || '/'
            pagesWithIssuesSet.add(pagePath)
            
            // If this is a high-severity issue, mark page as critical
            if (group.severity === 'high') {
              criticalPagesSet.add(pagePath)
            }
          } catch (e) {
            // Invalid URL, skip
            console.warn('[HealthScore] Invalid URL in example:', example.url)
          }
        }
      })
    }
  })
  
  const totalActive = activeGroups.length
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

/**
 * Calculate health score for multiple audits (aggregated)
 * 
 * This aggregates metrics across multiple audits for a domain.
 * Useful for calculating overall health score across audit history.
 * 
 * @param audits - Array of audit runs
 * @param ignoredSignatures - Set of ignored issue signatures
 * @returns Aggregated health score result
 */
export function calculateAggregatedHealthScore(
  audits: AuditRun[],
  ignoredSignatures: Set<string>
): HealthScoreResult {
  // Aggregate metrics across all audits
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
  }
  
  const pagesWithIssuesSet = new Set<string>()
  const criticalPagesSet = new Set<string>()
  const processedSignatures = new Set<string>() // Track unique issues across audits
  
  audits.forEach((audit) => {
    const issuesJson = audit.issues_json as any
    const groups = Array.isArray(issuesJson?.groups) ? issuesJson.groups : []
    
    groups.forEach((group: AuditIssueGroup) => {
      const signature = generateIssueSignature(group)
      
      // Skip ignored issues
      if (ignoredSignatures.has(signature)) return
      
      // Skip if we've already counted this issue (same signature across audits)
      if (processedSignatures.has(signature)) return
      processedSignatures.add(signature)
      
      // Count by severity
      if (group.severity === 'low') bySeverity.low++
      else if (group.severity === 'medium') bySeverity.medium++
      else if (group.severity === 'high') bySeverity.high++
      
      // Extract unique page URLs from examples
      if (group.examples && Array.isArray(group.examples)) {
        group.examples.forEach((example) => {
          if (example.url) {
            try {
              const url = new URL(example.url)
              const pagePath = url.pathname || '/'
              pagesWithIssuesSet.add(pagePath)
              
              if (group.severity === 'high') {
                criticalPagesSet.add(pagePath)
              }
            } catch (e) {
              console.warn('[HealthScore] Invalid URL in example:', example.url)
            }
          }
        })
      }
    })
  })
  
  const totalActive = processedSignatures.size
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

