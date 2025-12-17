// Transform audit issue groups to table row format
import { z } from "zod"
import { generateIssueSignature } from "./issue-signature"
import { IssueState, AuditIssueInstance } from "@/types/fortress"

/**
 * Derive issue category from title using pattern matching
 * 
 * @param title - Issue title to analyze
 * @returns Category enum value
 */
export function deriveCategory(title: string): 'typos' | 'grammar' | 'punctuation' | 'seo' | 'links' | 'terminology' | 'factual' | 'other' {
  const lower = title.toLowerCase()
  
  if (lower.includes('typo') || lower.includes('spelling')) return 'typos'
  if (lower.includes('grammar')) return 'grammar'
  if (lower.includes('punctuation')) return 'punctuation'
  if (lower.includes('seo') || lower.includes('meta') || lower.includes('alt') || lower.includes('h1') || lower.includes('title tag')) return 'seo'
  if (lower.includes('link') || lower.includes('404') || lower.includes('broken') || lower.includes('redirect')) return 'links'
  if (lower.includes('terminology') || lower.includes('inconsistent') || lower.includes('inconsistency')) return 'terminology'
  if (lower.includes('factual') || lower.includes('contradiction') || lower.includes('conflict')) return 'factual'
  
  return 'other'
}

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
  category?: string // Optional category for filtering/grouping
  instances?: AuditIssueInstance[] // Optional instances for nested row display
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

/**
 * Transform instances to table rows with grouping
 * Groups instances by category and severity for display
 * 
 * @param instances - Audit issue instances to transform
 * @param issueStates - Optional map/record of issue states keyed by signature
 * @param groupBy - Grouping strategy: 'category' (default) or 'url'
 * @returns Transformed table rows with grouped instances
 */
export function transformInstancesToTableRows(
  instances: AuditIssueInstance[],
  issueStates?: Map<string, IssueState> | Record<string, IssueState>,
  groupBy: 'category' | 'url' = 'category'
): AuditTableRow[] {
  // Handle empty instances array
  if (!instances || instances.length === 0) {
    return []
  }

  // Convert Record to Map if needed
  const statesMap = issueStates instanceof Map 
    ? issueStates 
    : issueStates 
      ? new Map(Object.entries(issueStates))
      : undefined

  // Group instances by the model's original title to preserve model grouping (or url)
  const groups = new Map<string, AuditIssueInstance[]>()
  
  instances.forEach((instance) => {
    // Skip invalid instances
    if (!instance || !instance.category || !instance.severity) {
      console.warn('[transformInstancesToTableRows] Skipping invalid instance:', instance)
      return
    }

    const key = groupBy === 'category' 
      ? instance.title
      : instance.url
    
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(instance)
  })

  // Convert groups to table rows
  return Array.from(groups.entries()).map(([key, groupInstances], index) => {
    const firstInstance = groupInstances[0]
    
    // Generate a group-level signature for state lookup (use first instance's signature as group identifier)
    // For grouping purposes, we use the first instance's signature
    const groupSignature = firstInstance.signature
    
    // Look up state if available (use first instance's state as group state)
    const state = statesMap?.get(groupSignature) || 'active'

    // Create group title using the descriptive title from instances
    // Use the first instance's title since it describes the specific issue type
    const title = groupBy === 'category'
      ? firstInstance.title
      : `Issues on ${firstInstance.url}`

    // Collect all examples from instances
    const examples = groupInstances.map(inst => ({
      url: inst.url,
      snippet: inst.snippet,
    }))

    return {
      id: `${key}-${index}`,
      title,
      severity: firstInstance.severity,
      impact: firstInstance.impact || '',
      fix: firstInstance.fix || '',
      examples,
      count: groupInstances.length,
      state,
      signature: groupSignature, // Use first instance signature for group-level state management
      category: firstInstance.category, // Add category for filtering
      instances: groupInstances, // Store instances for nested row display
    }
  })
}

