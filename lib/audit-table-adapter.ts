// Transform audit issues to table row format
import { Issue, IssueStatus } from "@/types/fortress"

/**
 * @deprecated Legacy interface - no longer used after issue model simplification
 * Kept only for type compatibility during migration period
 */
export interface AuditIssueGroup {
  title: string
  severity: "low" | "medium" | "high"
  impact: string
  fix: string
  examples: Array<{
    url: string
    snippet: string
  }>
  count: number
}

// Table row structure
export interface AuditTableRow {
  id: string
  title: string
  category?: string  // Optional - can remove if not using
  severity: 'low' | 'medium' | 'high'
  impact: string
  fix: string
  locations: Array<{ url: string; snippet: string }>
  status: 'active' | 'ignored' | 'resolved'
}

/**
 * Transform issues array to table row format
 * 
 * @param issues - Audit issues to transform
 * @returns Transformed table rows
 */
export function transformIssuesToTableRows(issues: Issue[]): AuditTableRow[] {
  return issues.map(issue => ({
    id: issue.id,
    title: issue.title,
    category: issue.category,  // Optional
    severity: issue.severity,
    impact: issue.impact || '',
    fix: issue.fix || '',
    locations: issue.locations || [],
    status: issue.status || 'active',
  }))
}

/**
 * Get severity badge variant
 * High: Destructive (red)
 * Medium: Warning (yellow/orange)
 * Low: Secondary (gray)
 */
export function getSeverityBadgeVariant(
  severity: "low" | "medium" | "high"
): "default" | "secondary" | "destructive" | "warning" {
  switch (severity) {
    case "high":
      return "destructive"
    case "medium":
      return "warning"
    case "low":
      return "secondary"
    default:
      return "secondary"
  }
}

/**
 * Filter audit groups by severity
 */
export function filterBySeverity(
  groups: AuditTableRow[],
  severity: "all" | "low" | "medium" | "high"
): AuditTableRow[] {
  if (severity === "all") {
    return groups
  }
  return groups.filter((group) => group.severity === severity)
}

// Legacy functions removed - no longer needed with simplified model

