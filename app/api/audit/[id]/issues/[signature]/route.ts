// Update issue state (ignore, resolve, restore)
// Gated to paid/enterprise users only
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { IssueState } from '@/types/fortress'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; signature: string }> }
) {
  try {
    // Auth check
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id

    // Get params
    const { id: auditId, signature } = await params

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { state } = body

    // Validate state
    if (!state || !['active', 'ignored', 'resolved'].includes(state)) {
      return NextResponse.json(
        { error: 'Invalid state. Must be "active", "ignored", or "resolved"' },
        { status: 400 }
      )
    }

    // Validate signature format (should be hex string, 64 chars for SHA256)
    // Allow case-insensitive hex and provide clearer error message
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json(
        { error: 'Invalid signature: must be a string' },
        { status: 400 }
      )
    }
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { error: `Invalid signature format: expected 64-character hexadecimal string (SHA256), got ${signature.length} characters` },
        { status: 400 }
      )
    }

    // Check user plan - gate to paid/enterprise users only
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()
    const plan = profile?.plan || 'free'

    if (plan === 'free') {
      return NextResponse.json(
        {
          error: 'Issue state management requires a paid plan. Please upgrade to manage issue states.',
          upgradeRequired: true
        },
        { status: 403 }
      )
    }

    // Fetch audit to get domain
    const { data: audit, error: auditErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('id, domain, user_id')
      .eq('id', auditId)
      .eq('user_id', userId)
      .maybeSingle()

    if (auditErr) {
      console.error('[IssueState] Error fetching audit:', auditErr)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if (!audit.domain) {
      return NextResponse.json({ error: 'Audit missing domain' }, { status: 400 })
    }

    // Upsert issue state
    // Use INSERT ... ON CONFLICT UPDATE to handle both new and existing states
    const { data: issueState, error: upsertErr } = await supabaseAdmin
      .from('audit_issue_states')
      .upsert(
        {
          user_id: userId,
          domain: audit.domain,
          signature,
          state: state as IssueState,
          audit_run_id: auditId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,domain,signature',
          ignoreDuplicates: false,
        }
      )
      .select()
      .maybeSingle()

    if (upsertErr) {
      console.error('[IssueState] Error upserting state:', upsertErr)
      return NextResponse.json({ error: 'Failed to update issue state' }, { status: 500 })
    }

    // If upsert didn't return data, fetch it
    let finalState = issueState
    if (!finalState) {
      const { data: fetchedState } = await supabaseAdmin
        .from('audit_issue_states')
        .select('*')
        .eq('user_id', userId)
        .eq('domain', audit.domain)
        .eq('signature', signature)
        .maybeSingle()
      finalState = fetchedState
    }

    if (!finalState) {
      return NextResponse.json({ error: 'Failed to retrieve updated state' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      state: finalState,
    })
  } catch (error) {
    console.error('[IssueState] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

