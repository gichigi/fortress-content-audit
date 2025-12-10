// API route to claim an unauthenticated audit after user signs up
// Transfers ownership from session_token to user_id

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function POST(request: Request) {
  try {
    // Must be authenticated
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = userData.user.id
    const body = await request.json().catch(() => ({}))
    const { sessionToken } = body

    if (!sessionToken || typeof sessionToken !== 'string') {
      return NextResponse.json({ error: 'Missing sessionToken' }, { status: 400 })
    }

    console.log(`[Audit Claim] User ${userId} claiming audit with session token: ${sessionToken}`)

    // Find the unclaimed audit by session token
    const { data: audit, error: findErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('id, user_id, domain')
      .eq('session_token', sessionToken)
      .is('user_id', null) // Only claim unclaimed audits
      .maybeSingle()

    if (findErr) {
      console.error('[Audit Claim] Error finding audit:', findErr)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!audit) {
      console.log('[Audit Claim] No unclaimed audit found for session token')
      return NextResponse.json({ error: 'Audit not found or already claimed' }, { status: 404 })
    }

    // Claim the audit by setting user_id and clearing session_token
    const { error: updateErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .update({
        user_id: userId,
        session_token: null, // Clear the session token
        is_preview: false, // No longer a preview once claimed
      })
      .eq('id', audit.id)

    if (updateErr) {
      console.error('[Audit Claim] Error claiming audit:', updateErr)
      return NextResponse.json({ error: 'Failed to claim audit' }, { status: 500 })
    }

    console.log(`[Audit Claim] Successfully claimed audit ${audit.id} for user ${userId}`)

    return NextResponse.json({
      success: true,
      auditId: audit.id,
      domain: audit.domain,
    })
  } catch (e) {
    console.error('[Audit Claim] Unexpected error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Claim failed' },
      { status: 500 }
    )
  }
}

