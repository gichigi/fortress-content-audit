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

// New instance-based AuditIssue matching audit_issues table
export interface AuditIssueInstance {
  id: string
  audit_id: string
  category: 'typos' | 'grammar' | 'punctuation' | 'seo' | 'links' | 'terminology' | 'factual' | 'other'
  severity: 'low' | 'medium' | 'high'
  title: string
  url: string
  snippet: string
  impact: string | null
  fix: string | null
  signature: string
  created_at: string
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

// Issue State Management (Phase 4)
export type IssueState = 'active' | 'ignored' | 'resolved'

export interface IssueStateRecord {
  id: string
  user_id: string
  domain: string
  signature: string
  state: IssueState
  audit_run_id: string | null
  created_at: string
  updated_at: string
}

export interface AuditIssuesJson {
  groups: Array<{
    title: string
    severity: 'low' | 'medium' | 'high'
    impact: string
    fix: string
    examples: Array<{ url: string; snippet: string }>
    count: number
  }>
  auditedUrls?: string[]
  // Note: issueStates now stored in audit_issue_states table, not in JSONB
  // Note: instances now stored in audit_issues table, groups kept for backward compatibility
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


