// Transform audit issue groups to table row format
import { z } from "zod"
import { generateIssueSignature } from "./issue-signature"
import { IssueState } from "@/types/fortress"

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
  state?: IssueState // Optional state for filtered views
  signature?: string // Optional signature for state management
}

/**
 * Transform audit groups array to table row format
 * 
 * @param groups - Audit issue groups to transform
 * @param issueStates - Optional map/record of issue states keyed by signature
 * @returns Transformed table rows with optional state information
 */
export function transformAuditToTableRows(
  groups: AuditIssueGroup[],
  issueStates?: Map<string, IssueState> | Record<string, IssueState>
): AuditTableRow[] {
  // Convert Record to Map if needed for consistent API
  const statesMap = issueStates instanceof Map 
    ? issueStates 
    : issueStates 
      ? new Map(Object.entries(issueStates))
      : undefined

  return groups.map((group, index) => {
    // Generate signature for state lookup
    const signature = generateIssueSignature(group)
    
    // Create unique ID from title + first example URL + index
    const firstUrl = group.examples?.[0]?.url || ""
    const id = `${group.title}-${firstUrl}-${index}`.replace(/[^a-zA-Z0-9-]/g, "-")

    // Look up state if available
    const state = statesMap?.get(signature) || 'active'

    return {
      id,
      title: group.title,
      severity: group.severity,
      impact: group.impact,
      fix: group.fix,
      examples: group.examples || [],
      count: group.count || 0,
      state,
      signature,
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

/**
 * Filter audit groups by issue state
 * 
 * @param groups - Audit issue groups to filter
 * @param issueStates - Map or record of issue states keyed by signature
 * @param showState - State to show ('active', 'ignored', 'resolved'). Defaults to 'active' (excludes ignored)
 * @returns Filtered groups matching the specified state
 */
export function filterIssuesByState(
  groups: AuditIssueGroup[],
  issueStates: Map<string, IssueState> | Record<string, IssueState>,
  showState?: 'active' | 'ignored' | 'resolved'
): AuditIssueGroup[] {
  // Convert Record to Map if needed
  const statesMap = issueStates instanceof Map 
    ? issueStates 
    : new Map(Object.entries(issueStates))

  // Default to 'active' which excludes ignored issues
  const targetState = showState || 'active'

  return groups.filter((group) => {
    const signature = generateIssueSignature(group)
    const state = statesMap.get(signature) || 'active' // Default to active if not found
    return state === targetState
  })
}

