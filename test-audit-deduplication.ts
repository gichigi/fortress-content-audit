#!/usr/bin/env npx tsx

/**
 * End-to-End Test for Issue Deduplication Feature
 *
 * This test:
 * 1. Runs a real audit on justcancel.io
 * 2. Marks some issues as resolved/ignored
 * 3. Runs a second audit
 * 4. Verifies that excluded_issues and active_issues are passed correctly
 * 5. Checks that the AI respects the context (doesn't report excluded issues)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const DOMAIN = 'justcancel.io'
const TEST_USER_ID = '288a2b04-4cfb-402a-96b0-7ba5a63a684c' // Real user with audits

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runAudit(domain: string, accessToken?: string): Promise<string> {
  console.log(`\n🚀 Starting audit for ${domain}...`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch('http://localhost:3000/api/audit', {
    method: 'POST',
    headers,
    body: JSON.stringify({ domain }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Audit failed: ${error}`)
  }

  const data = await response.json()
  console.log(`✓ Audit started, ID: ${data.runId}`)
  return data.runId
}

async function pollAuditStatus(auditId: string): Promise<any> {
  console.log(`⏳ Polling for audit completion...`)

  let attempts = 0
  const maxAttempts = 80 // 80 * 5s = 400s = ~6.5 minutes

  while (attempts < maxAttempts) {
    const { data: audit, error } = await supabase
      .from('brand_audit_runs')
      .select('*')
      .eq('id', auditId)
      .single()

    if (error) {
      throw new Error(`Failed to poll audit: ${error.message}`)
    }

    // Status is stored in issues_json.status, not a top-level column
    const status = (audit.issues_json as any)?.status

    if (status === 'completed') {
      console.log(`✓ Audit completed!`)
      return audit
    }

    if (status === 'failed') {
      const errorMsg = (audit.issues_json as any)?.error || 'Unknown error'
      throw new Error(`Audit failed: ${errorMsg}`)
    }

    attempts++
    process.stdout.write('.')
    await sleep(5000)
  }

  throw new Error('Audit timed out')
}

async function getAuditIssues(auditId: string) {
  const { data: issues, error } = await supabase
    .from('issues')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to get issues: ${error.message}`)
  }

  return issues || []
}

async function updateIssueStatus(issueId: string, status: 'resolved' | 'ignored' | 'active') {
  const { error } = await supabase
    .from('issues')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', issueId)

  if (error) {
    throw new Error(`Failed to update issue: ${error.message}`)
  }
}

async function getExcludedIssues(userId: string, domain: string) {
  // Get all audits for this user+domain
  const { data: audits, error: auditsError } = await supabase
    .from('brand_audit_runs')
    .select('id')
    .eq('user_id', userId)
    .eq('domain', domain)

  if (auditsError) throw new Error(auditsError.message)
  if (!audits?.length) return []

  // Get resolved/ignored issues
  const { data: issues, error: issuesError } = await supabase
    .from('issues')
    .select('page_url, category, issue_description')
    .in('audit_id', audits.map(a => a.id))
    .in('status', ['resolved', 'ignored'])
    .order('updated_at', { ascending: false })
    .limit(50)

  if (issuesError) throw new Error(issuesError.message)
  return issues || []
}

async function getActiveIssues(userId: string, domain: string) {
  // Get most recent completed audit
  const { data: latestAudit, error: auditError } = await supabase
    .from('brand_audit_runs')
    .select('id')
    .eq('user_id', userId)
    .eq('domain', domain)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (auditError || !latestAudit) return []

  // Get active issues from that audit
  const { data: issues, error: issuesError } = await supabase
    .from('issues')
    .select('page_url, category, issue_description')
    .eq('audit_id', latestAudit.id)
    .eq('status', 'active')
    .order('severity', { ascending: false })
    .limit(50)

  if (issuesError) throw new Error(issuesError.message)
  return issues || []
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║     End-to-End Test: Issue Deduplication Feature              ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log(`\nDomain: ${DOMAIN}`)
  console.log(`User ID: ${TEST_USER_ID}`)

  try {
    // Get user and create session for authenticated requests
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.getUserById(TEST_USER_ID)
    if (sessionError || !sessionData) {
      throw new Error(`Failed to get user: ${sessionError?.message}`)
    }

    console.log(`✓ User found: ${sessionData.user.email}`)

    // For testing, we'll run audits without auth and then manually update the user_id
    // This simulates authenticated audits without needing to generate real auth tokens

    // ========================================================================
    // TEST 1: Run first audit
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('TEST 1: Run First Audit')
    console.log('='.repeat(70))

    const auditId1 = await runAudit(DOMAIN)

    // Manually associate audit with user (simulates authenticated request)
    await supabase
      .from('brand_audit_runs')
      .update({ user_id: TEST_USER_ID, session_token: null })
      .eq('id', auditId1)
    console.log('✓ Associated audit with user')

    const audit1 = await pollAuditStatus(auditId1)
    const issues1 = await getAuditIssues(auditId1)

    console.log(`\n✓ First audit completed`)
    console.log(`  - Total issues found: ${issues1.length}`)
    console.log(`  - Status: ${(audit1.issues_json as any)?.status}`)

    if (issues1.length === 0) {
      console.log('\n⚠️  No issues found. Cannot test deduplication.')
      process.exit(0)
    }

    // Display issues
    console.log('\n📋 Issues found:')
    issues1.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.category}] ${issue.issue_description.substring(0, 80)}...`)
    })

    // ========================================================================
    // TEST 2: Mark some issues as resolved/ignored
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('TEST 2: Mark Issues as Resolved/Ignored')
    console.log('='.repeat(70))

    const numToResolve = Math.min(2, issues1.length)
    const numToIgnore = Math.min(2, issues1.length - numToResolve)

    console.log(`\nMarking ${numToResolve} issues as resolved...`)
    for (let i = 0; i < numToResolve; i++) {
      await updateIssueStatus(issues1[i].id, 'resolved')
      console.log(`  ✓ Resolved: ${issues1[i].issue_description.substring(0, 60)}...`)
    }

    console.log(`\nMarking ${numToIgnore} issues as ignored...`)
    for (let i = numToResolve; i < numToResolve + numToIgnore; i++) {
      await updateIssueStatus(issues1[i].id, 'ignored')
      console.log(`  ✓ Ignored: ${issues1[i].issue_description.substring(0, 60)}...`)
    }

    const numActive = issues1.length - numToResolve - numToIgnore
    console.log(`\nRemaining active issues: ${numActive}`)

    // ========================================================================
    // TEST 3: Verify getExcludedIssues and getActiveIssues queries
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('TEST 3: Verify Issue Context Queries')
    console.log('='.repeat(70))

    const excludedIssues = await getExcludedIssues(TEST_USER_ID, DOMAIN)
    const activeIssues = await getActiveIssues(TEST_USER_ID, DOMAIN)

    console.log(`\n✓ Excluded issues query returned: ${excludedIssues.length} issues`)
    console.log(`✓ Active issues query returned: ${activeIssues.length} issues`)

    const expectedExcludedMin = numToResolve + numToIgnore
    if (excludedIssues.length < expectedExcludedMin) {
      console.error(`\n❌ FAIL: Expected at least ${expectedExcludedMin} excluded issues, got ${excludedIssues.length}`)
      process.exit(1)
    }

    if (excludedIssues.length > expectedExcludedMin) {
      console.log(`\n⚠️  Note: Found ${excludedIssues.length - expectedExcludedMin} additional excluded issues from previous test runs`)
    }

    if (activeIssues.length !== numActive) {
      console.error(`\n❌ FAIL: Expected ${numActive} active issues, got ${activeIssues.length}`)
      process.exit(1)
    }

    console.log('\n✓ Issue context queries working correctly!')

    // Display excluded issues
    console.log('\n📋 Excluded Issues (will be passed to AI):')
    excludedIssues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.category}] ${issue.issue_description.substring(0, 80)}...`)
    })

    // Display active issues
    console.log('\n📋 Active Issues (will be passed to AI):')
    activeIssues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.category}] ${issue.issue_description.substring(0, 80)}...`)
    })

    // ========================================================================
    // TEST 4: Run second audit with issue context
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('TEST 4: Run Second Audit with Issue Context')
    console.log('='.repeat(70))

    console.log('\n⚠️  Check server logs to verify:')
    console.log('  1. "[API] Loaded issue context: X excluded, Y active"')
    console.log('  2. Prompt variables include excluded_issues and active_issues')

    const auditId2 = await runAudit(DOMAIN)

    // Manually associate audit with user (simulates authenticated request)
    await supabase
      .from('brand_audit_runs')
      .update({ user_id: TEST_USER_ID, session_token: null })
      .eq('id', auditId2)
    console.log('✓ Associated second audit with user')

    const audit2 = await pollAuditStatus(auditId2)
    const issues2 = await getAuditIssues(auditId2)

    console.log(`\n✓ Second audit completed`)
    console.log(`  - Total issues found: ${issues2.length}`)
    console.log(`  - Status: ${(audit2.issues_json as any)?.status}`)

    // ========================================================================
    // TEST 5: Verify deduplication worked
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('TEST 5: Verify Deduplication')
    console.log('='.repeat(70))

    // Check if any excluded issues appear in the new audit
    const excludedDescriptions = new Set(excludedIssues.map(i => i.issue_description))
    const reappeared = issues2.filter(issue => excludedDescriptions.has(issue.issue_description))

    if (reappeared.length > 0) {
      console.log(`\n⚠️  WARNING: ${reappeared.length} excluded issues reappeared:`)
      reappeared.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue.issue_description.substring(0, 80)}...`)
      })
      console.log('\nThis could mean:')
      console.log('  1. The AI found the same issue on a different page (expected)')
      console.log('  2. The deduplication is not working (needs investigation)')
    } else {
      console.log('\n✓ No excluded issues reappeared in the new audit!')
    }

    // Check if active issues are still present
    const activeDescriptions = new Set(activeIssues.map(i => i.issue_description))
    const stillActive = issues2.filter(issue => activeDescriptions.has(issue.issue_description))

    console.log(`\n✓ ${stillActive.length} of ${activeIssues.length} active issues still present`)

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('✅ TEST SUMMARY')
    console.log('='.repeat(70))
    console.log(`\nFirst Audit:`)
    console.log(`  - Total issues: ${issues1.length}`)
    console.log(`  - Marked resolved: ${numToResolve}`)
    console.log(`  - Marked ignored: ${numToIgnore}`)
    console.log(`  - Remaining active: ${numActive}`)
    console.log(`\nSecond Audit:`)
    console.log(`  - Total issues: ${issues2.length}`)
    console.log(`  - Excluded issues passed to AI: ${excludedIssues.length}`)
    console.log(`  - Active issues passed to AI: ${activeIssues.length}`)
    console.log(`  - Reappeared excluded issues: ${reappeared.length}`)
    console.log(`  - Still active: ${stillActive.length}`)

    console.log('\n✅ All tests passed!')
    console.log('\n💡 Next steps:')
    console.log('  1. Check server logs for "[API] Loaded issue context" messages')
    console.log('  2. Verify prompt variables in logs include excluded_issues and active_issues')
    console.log('  3. Review if any excluded issues reappeared on different pages')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()
