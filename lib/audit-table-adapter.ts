// Transform audit issues to table row format
import { Issue, IssueStatus, type IssueCategory } from "@/types/fortress"

/**
 * @deprecated Legacy interface - no longer used after issue model simplification
 * Kept only for type compatibility during migration period
 */
export interface AuditIssueGroup {
  title: string
  severity: "low" | "medium" | "critical"
  impact: string
  fix: string
  examples: Array<{
    url: string
    snippet: string
  }>
  count: number
}

// Table row structure (matches new prompt format)
export interface AuditTableRow {
  id: string
  page_url: string
  category: IssueCategory
  issue_description: string
  severity: 'low' | 'medium' | 'critical'
  suggested_fix: string
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
    page_url: issue.page_url,
    category: issue.category,
    issue_description: issue.issue_description,
    severity: issue.severity,
    suggested_fix: issue.suggested_fix,
    status: issue.status || 'active',
  }))
}

/**
 * Get severity badge variant
 * Critical: Destructive (red)
 * Medium: Warning (yellow/orange)
 * Low: Secondary (gray)
 */
export function getSeverityBadgeVariant(
  severity: "low" | "medium" | "critical"
): "default" | "secondary" | "destructive" | "warning" {
  switch (severity) {
    case "critical":
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
  severity: "all" | "low" | "medium" | "critical"
): AuditTableRow[] {
  if (severity === "all") {
    return groups
  }
  return groups.filter((group) => group.severity === severity)
}

// Legacy functions removed - no longer needed with simplified model

