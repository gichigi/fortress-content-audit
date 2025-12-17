import { Database } from './database.types'

// Application-specific types for Fortress


// Audits
export type AuditRun = Database['public']['Tables']['brand_audit_runs']['Row']

// Legacy AuditIssue interface (kept for backward compatibility)
export interface AuditIssue {
  category: string
  severity: 'high' | 'medium' | 'low'
  issue: string
  recommendation: string
  url?: string
  snippet?: string
}

// New simplified Issue matching issues table
export type IssueStatus = 'active' | 'ignored' | 'resolved'

export interface Issue {
  id: string
  audit_id: string
  title: string
  category?: string  // Optional: 'typos', 'grammar', 'seo', 'factual', 'links', 'terminology'
  severity: 'low' | 'medium' | 'high'
  impact: string | null
  fix: string | null
  locations: Array<{ url: string; snippet: string }>
  status: IssueStatus
  created_at: string
  updated_at: string
}

export interface AuditResult {
  issues: AuditIssue[]
  score?: number
}

// Plans
export type PlanType = 'free' | 'pro' // 'Outpost' | 'Watchtower' in UI

export interface UserProfile extends Database['public']['Tables']['profiles']['Row'] {
  plan: PlanType
}

// Issue State Management - now handled by status column on issues table
// Legacy: IssueState kept for backward compatibility during migration
export type IssueState = 'active' | 'ignored' | 'resolved' // Deprecated, use IssueStatus

export interface AuditIssuesJson {
  issues?: Array<{
    title: string
    category?: string
    severity: 'low' | 'medium' | 'high'
    impact?: string
    fix?: string
    locations: Array<{ url: string; snippet: string }>
  }>
  groups?: Array<{  // Legacy format, kept for backward compatibility
    title: string
    severity: 'low' | 'medium' | 'high'
    impact: string
    fix: string
    examples: Array<{ url: string; snippet: string }>
    count: number
  }>
  auditedUrls?: string[]
  // Note: issues now stored in issues table, issues_json kept as backup/legacy
}

// Advanced Generators
export interface GeneratedKeyword {
  keyword: string
  relevance: number
  volume?: string
}

export interface GeneratedRule {
  rule: string
  example_good: string
  example_bad: string
}

export interface GeneratedTypography {
  category: 'Primary' | 'Secondary' | 'Accent'
  font: string
  usage: string
}

export interface GeneratedGlossaryTerm {
  term: string
  definition: string
  usage_notes?: string
}


