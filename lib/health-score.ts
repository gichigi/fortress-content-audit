import { AuditRun } from "@/types/fortress"
import { AuditIssueGroup } from "./audit-table-adapter"
import { generateIssueSignature } from "./issue-signature"
import { IssueState } from "@/types/fortress"
import { supabaseAdmin } from "./supabase-admin"
import { AuditIssueInstance } from "@/types/fortress"

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
 * - Counts instances, not groups
 * 
 * @param audit - Audit run (instances queried from audit_issues table)
 * @param ignoredSignatures - Set of ignored issue signatures
 * @returns Health score result with metrics
 */
export async function calculateHealthScore(
  audit: AuditRun,
  ignoredSignatures: Set<string>
): Promise<HealthScoreResult> {
  // Query instances from audit_issues table
  const { data: instances, error } = await (supabaseAdmin as any)
    .from('audit_issues')
    .select('*')
    .eq('audit_id', audit.id)

  if (error) {
    console.error('[HealthScore] Error fetching instances:', error)
    // Fallback to issues_json for backward compatibility
    return calculateHealthScoreFromGroups(audit, ignoredSignatures)
  }

  // Filter out ignored instances
  const activeInstances = (instances || []).filter((instance: AuditIssueInstance) => {
    return !ignoredSignatures.has(instance.signature)
  })
  
  // Count instances by severity
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
  }
  
  // Track unique pages with issues
  const pagesWithIssuesSet = new Set<string>()
  
  // Track unique critical pages (pages with high-severity issues)
  const criticalPagesSet = new Set<string>()
  
  activeInstances.forEach((instance: AuditIssueInstance) => {
    // Count by severity
    if (instance.severity === 'low') bySeverity.low++
    else if (instance.severity === 'medium') bySeverity.medium++
    else if (instance.severity === 'high') bySeverity.high++
    
    // Extract page path from URL
    try {
      const url = new URL(instance.url)
      const pagePath = url.pathname || '/'
      pagesWithIssuesSet.add(pagePath)
      
      // If this is a high-severity issue, mark page as critical
      if (instance.severity === 'high') {
        criticalPagesSet.add(pagePath)
      }
    } catch (e) {
      // Invalid URL, skip
      console.warn('[HealthScore] Invalid URL in instance:', instance.url)
    }
  })
  
  const totalActive = activeInstances.length
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
 * Fallback: Calculate health score from groups (backward compatibility)
 */
function calculateHealthScoreFromGroups(
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
 * Counts instances, not groups.
 * 
 * @param audits - Array of audit runs
 * @param ignoredSignatures - Set of ignored issue signatures
 * @returns Aggregated health score result
 */
export async function calculateAggregatedHealthScore(
  audits: AuditRun[],
  ignoredSignatures: Set<string>
): Promise<HealthScoreResult> {
  // Aggregate metrics across all audits
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
  }
  
  const pagesWithIssuesSet = new Set<string>()
  const criticalPagesSet = new Set<string>()
  const processedSignatures = new Set<string>() // Track unique instances across audits
  
  // Query all instances for all audits
  const auditIds = audits.map(a => a.id)
  
  const { data: allInstances, error } = await (supabaseAdmin as any)
    .from('audit_issues')
    .select('*')
    .in('audit_id', auditIds)

  if (error) {
    console.error('[HealthScore] Error fetching instances:', error)
    // Fallback to groups for backward compatibility
    return calculateAggregatedHealthScoreFromGroups(audits, ignoredSignatures)
  }

  // Process instances
  (allInstances || []).forEach((instance: AuditIssueInstance) => {
    // Skip ignored instances
    if (ignoredSignatures.has(instance.signature)) return
    
    // Skip if we've already counted this instance (same signature across audits)
    if (processedSignatures.has(instance.signature)) return
    processedSignatures.add(instance.signature)
    
    // Count by severity
    if (instance.severity === 'low') bySeverity.low++
    else if (instance.severity === 'medium') bySeverity.medium++
    else if (instance.severity === 'high') bySeverity.high++
    
    // Extract page path from URL
    try {
      const url = new URL(instance.url)
      const pagePath = url.pathname || '/'
      pagesWithIssuesSet.add(pagePath)
      
      if (instance.severity === 'high') {
        criticalPagesSet.add(pagePath)
      }
    } catch (e) {
      console.warn('[HealthScore] Invalid URL in instance:', instance.url)
    }
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

/**
 * Fallback: Calculate aggregated health score from groups (backward compatibility)
 */
function calculateAggregatedHealthScoreFromGroups(
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

