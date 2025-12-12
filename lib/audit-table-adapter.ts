// Transform audit issue groups to table row format
import { z } from "zod"

// Audit issue group structure from API
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
  id: string // Use title + first example URL as unique ID
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

/**
 * Transform audit groups array to table row format
 */
export function transformAuditToTableRows(
  groups: AuditIssueGroup[]
): AuditTableRow[] {
  return groups.map((group, index) => {
    // Create unique ID from title + first example URL + index
    const firstUrl = group.examples?.[0]?.url || ""
    const id = `${group.title}-${firstUrl}-${index}`.replace(/[^a-zA-Z0-9-]/g, "-")

    return {
      id,
      title: group.title,
      severity: group.severity,
      impact: group.impact,
      fix: group.fix,
      examples: group.examples || [],
      count: group.count || 0,
    }
  })
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

