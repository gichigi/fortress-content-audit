// Update issue status (ignore, resolve, restore)
// Available to all authenticated users
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { IssueStatus } from '@/types/fortress'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
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
      console.error('[IssueStatus] Error fetching audit:', auditErr)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
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
      console.error('[IssueStatus] Error updating issue:', updateErr)
      return NextResponse.json({ error: 'Failed to update issue status' }, { status: 500 })
    }

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      issue,
    })
  } catch (error) {
    console.error('[IssueStatus] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

