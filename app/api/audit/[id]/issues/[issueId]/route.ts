// Update issue status (ignore, resolve, restore)
// Available to all authenticated users
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { IssueStatus } from '@/types/fortress'
import Logger from '@/lib/logger'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  try {
    // Auth check
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 })
    }
    const userId = userData.user.id

    // Get params
    const { id: auditId, issueId } = await params

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { status } = body

    // Validate status
    if (!status || !['active', 'ignored', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "active", "ignored", or "resolved"' },
        { status: 400 }
      )
    }

    // Validate issueId format (should be UUID)
    if (!issueId || typeof issueId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid issueId: must be a string' },
        { status: 400 }
      )
    }

    // Verify audit ownership
    const { data: audit, error: auditErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('id, user_id')
      .eq('id', auditId)
      .eq('user_id', userId)
      .maybeSingle()

    if (auditErr) {
      Logger.error('[IssueStatus] Error fetching audit', auditErr instanceof Error ? auditErr : new Error(String(auditErr)))
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    if (!audit) {
      return NextResponse.json({ error: 'The requested audit was not found.' }, { status: 404 })
    }

    // Update issue status directly
    const { data: issue, error: updateErr } = await (supabaseAdmin as any)
      .from('issues')
      .update({ 
        status: status as IssueStatus, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', issueId)
      .eq('audit_id', auditId)
      .select()
      .single()

    if (updateErr) {
      Logger.error('[IssueStatus] Error updating issue', updateErr instanceof Error ? updateErr : new Error(String(updateErr)))
      return NextResponse.json({ error: 'Something went wrong updating the issue. Please try again.' }, { status: 500 })
    }

    if (!issue) {
      return NextResponse.json({ error: 'The requested issue was not found.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      issue,
    })
  } catch (error) {
    Logger.error('[IssueStatus] Unexpected error', error instanceof Error ? error : new Error(String(error)), {
      ...(process.env.NODE_ENV === 'development' ? { stack: error instanceof Error ? error.stack : undefined } : {})
    })
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

