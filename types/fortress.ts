import { Database } from './database.types'

// Application-specific types for Fortress


// Audits
export type AuditRun = Database['public']['Tables']['brand_audit_runs']['Row']

export interface AuditIssue {
  category: string
  severity: 'high' | 'medium' | 'low'
  issue: string
  recommendation: string
  url?: string
  snippet?: string
}

export interface AuditResult {
  issues: AuditIssue[]
  summary: string
  score?: number
}

// Plans
export type PlanType = 'free' | 'pro' // 'Outpost' | 'Watchtower' in UI

export interface UserProfile extends Database['public']['Tables']['profiles']['Row'] {
  plan: PlanType
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


