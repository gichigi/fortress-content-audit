// API route to claim an unauthenticated audit after user signs up
// Transfers ownership from session_token to user_id

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Logger from '@/lib/logger'
import { incrementAuditUsage } from '@/lib/audit-rate-limit'

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
      return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 })
    }

    const userId = userData.user.id
    const body = await request.json().catch(() => ({}))
    const { sessionToken } = body

    if (!sessionToken || typeof sessionToken !== 'string') {
      return NextResponse.json({ error: 'Missing required parameter. Please try again.' }, { status: 400 })
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
      Logger.error('[Audit Claim] Error finding audit', findErr instanceof Error ? findErr : new Error(String(findErr)))
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    if (!audit) {
      Logger.warn('[Audit Claim] No unclaimed audit found for session token')
      return NextResponse.json({ error: 'The requested audit was not found or has already been claimed.' }, { status: 404 })
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
      Logger.error('[Audit Claim] Error claiming audit', updateErr instanceof Error ? updateErr : new Error(String(updateErr)))
      return NextResponse.json({ 
        error: 'Something went wrong claiming the audit. Please try again.'
      }, { status: 500 })
    }

    console.log(`[Audit Claim] Successfully claimed audit ${audit.id} for user ${userId}`)

    // Backfill usage for the claimed audit
    if (audit.domain) {
      try {
        await incrementAuditUsage(userId, audit.domain)
        console.log(`[Audit Claim] Backfilled usage for domain ${audit.domain}`)
      } catch (error) {
        console.error('[Audit Claim] Failed to backfill usage:', error)
        // Don't fail the claim if usage backfill fails
      }
    }

    return NextResponse.json({
      success: true,
      auditId: audit.id,
      domain: audit.domain,
    })
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    Logger.error('[Audit Claim] Unexpected error', error, {
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    })
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

