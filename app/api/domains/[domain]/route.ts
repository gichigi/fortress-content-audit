// fortress v1 - Domain Deletion API
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

/**
 * DELETE /api/domains/[domain]
 * 
 * Deletes all data for a domain (audits, issue states, usage records)
 * Requires authentication and ownership verification
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  // Immediately await params to prevent Next.js 15 enumeration warnings
  const { domain } = await params
  try {
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id
    if (!domain) {
      return NextResponse.json({ error: 'Domain parameter required' }, { status: 400 })
    }

    // Normalize domain (decode URL encoding, remove protocol, www, trailing slash)
    let normalizedDomain = decodeURIComponent(domain)
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

    // Verify user owns at least one audit for this domain
    const { data: auditCheck, error: checkError } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('id')
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)
      .limit(1)
      .maybeSingle()

    if (checkError) {
      console.error('[DomainDelete] Error checking ownership:', checkError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // If no audit found, return 404 (don't reveal existence of domain)
    if (!auditCheck) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }

    // Check for in-progress audits (audits with responseId in issues_json)
    const { data: inProgressAudits } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('id, issues_json')
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)

    const hasInProgress = inProgressAudits?.some((audit) => {
      const issuesJson = audit.issues_json as any
      return issuesJson?.responseId || issuesJson?.status === 'in_progress'
    })

    if (hasInProgress) {
      return NextResponse.json(
        { 
          error: 'Cannot delete domain with in-progress audits',
          message: 'Please wait for all audits to complete before deleting this domain.'
        },
        { status: 400 }
      )
    }

    // Delete all domain data in transaction-like sequence
    // Note: Supabase doesn't support transactions in JS client, so we do sequential deletes
    // If any delete fails, we log but continue (best effort cleanup)

    // 1. Delete audit_usage records
    const { error: usageError } = await supabaseAdmin
      .from('audit_usage')
      .delete()
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)

    if (usageError) {
      console.error('[DomainDelete] Error deleting audit_usage:', usageError)
      // Continue with other deletes
    }

    // 2. Delete audit_issue_states
    const { error: statesError } = await supabaseAdmin
      .from('audit_issue_states')
      .delete()
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)

    if (statesError) {
      console.error('[DomainDelete] Error deleting audit_issue_states:', statesError)
      // Continue with other deletes
    }

    // 3. Delete brand_audit_runs (this is the main data)
    const { error: auditsError } = await supabaseAdmin
      .from('brand_audit_runs')
      .delete()
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)

    if (auditsError) {
      console.error('[DomainDelete] Error deleting brand_audit_runs:', auditsError)
      return NextResponse.json(
        { error: 'Failed to delete domain data' },
        { status: 500 }
      )
    }

    // If we got here, deletion was successful (even if some sub-deletes had errors)
    return NextResponse.json({
      success: true,
      message: 'Domain deleted successfully',
      domain: normalizedDomain,
    })
  } catch (e) {
    console.error('[DomainDelete] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete domain' },
      { status: 500 }
    )
  }
}



