/**
 * Test database helpers
 * Utilities for setting up and cleaning up test data
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { AuditIssueGroup } from '@/lib/audit-table-adapter'
import { IssueState } from '@/types/fortress'

const supabase = getSupabaseAdmin()

/**
 * Generate mock audit issue group
 */
export function createMockAuditGroup(overrides?: Partial<AuditIssueGroup>): AuditIssueGroup {
  return {
    title: overrides?.title || 'Inconsistent Product Name',
    severity: overrides?.severity || 'high',
    impact: overrides?.impact || 'Confuses users about product identity',
    fix: overrides?.fix || "Standardize to 'ProductName' across all pages",
    examples: overrides?.examples || [
      { url: 'https://example.com/pricing', snippet: 'ProductName Pro' },
      { url: 'https://example.com/features', snippet: 'Product-Name Plus' },
    ],
    count: overrides?.count || 5,
  }
}

/**
 * Generate complete mock audit data
 */
export function createMockAuditData(domain: string = 'example.com', groupCount: number = 3) {
  const groups: AuditIssueGroup[] = []
  const severities: Array<'low' | 'medium' | 'high'> = ['high', 'medium', 'low']
  
  for (let i = 0; i < groupCount; i++) {
    groups.push(createMockAuditGroup({
      title: `Test Issue ${i + 1}`,
      severity: severities[i % severities.length],
      examples: [
        { url: `https://${domain}/page${i + 1}`, snippet: `Snippet ${i + 1}` },
      ],
    }))
  }

  return {
    groups,
    pagesScanned: groupCount * 2,
    auditedUrls: groups.map(g => g.examples[0].url),
  }
}

/**
 * Generate unique session token for testing
 */
export function generateSessionToken(): string {
  return `test_session_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Create test audit in database (unauthenticated)
 */
export async function createTestAuditUnauthenticated(
  sessionToken: string,
  domain: string = 'test-example.com'
) {
  const mockData = createMockAuditData(domain)
  const issuesJson = {
    groups: mockData.groups,
    auditedUrls: mockData.auditedUrls,
  }

  const { data, error } = await supabase
    .from('brand_audit_runs')
    .insert({
      user_id: null,
      session_token: sessionToken,
      domain,
      pages_scanned: mockData.pagesScanned,
      issues_json: issuesJson,
      is_preview: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Create test audit in database (authenticated)
 */
export async function createTestAuditAuthenticated(
  userId: string,
  domain: string = 'test-example.com'
) {
  const mockData = createMockAuditData(domain)
  const issuesJson = {
    groups: mockData.groups,
    auditedUrls: mockData.auditedUrls,
  }

  const { data, error } = await supabase
    .from('brand_audit_runs')
    .insert({
      user_id: userId,
      session_token: null,
      domain,
      pages_scanned: mockData.pagesScanned,
      issues_json: issuesJson,
      is_preview: false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Create test issue state
 */
export async function createTestIssueState(
  userId: string,
  domain: string,
  signature: string,
  state: IssueState = 'active',
  auditRunId: string | null = null
) {
  const { data, error } = await supabase
    .from('audit_issue_states')
    .upsert({
      user_id: userId,
      domain,
      signature,
      state,
      audit_run_id: auditRunId,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Clean up test audits by session token
 */
export async function cleanupTestAuditsBySessionToken(sessionToken: string) {
  await supabase
    .from('brand_audit_runs')
    .delete()
    .eq('session_token', sessionToken)
}

/**
 * Clean up test audits by user ID
 */
export async function cleanupTestAuditsByUserId(userId: string) {
  await supabase
    .from('brand_audit_runs')
    .delete()
    .eq('user_id', userId)
}

/**
 * Clean up test issue states by user ID
 */
export async function cleanupTestIssueStatesByUserId(userId: string) {
  await supabase
    .from('audit_issue_states')
    .delete()
    .eq('user_id', userId)
}

/**
 * Clean up test issue states by domain
 */
export async function cleanupTestIssueStatesByDomain(domain: string) {
  await supabase
    .from('audit_issue_states')
    .delete()
    .eq('domain', domain)
}

/**
 * Clean up all test data for a user
 */
export async function cleanupTestDataForUser(userId: string) {
  await Promise.all([
    cleanupTestAuditsByUserId(userId),
    cleanupTestIssueStatesByUserId(userId),
  ])
}

/**
 * Clean up all test data for a session token
 */
export async function cleanupTestDataForSessionToken(sessionToken: string) {
  await cleanupTestAuditsBySessionToken(sessionToken)
}


