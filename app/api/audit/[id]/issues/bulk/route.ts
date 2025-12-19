// Bulk update issue statuses
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
  { params }: { params: Promise<{ id: string }> }
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
    const { id: auditId } = await params

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { issueIds, status } = body

    // Validate inputs
    if (!Array.isArray(issueIds) || issueIds.length === 0) {
      return NextResponse.json(
        { error: 'issueIds must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!status || !['active', 'ignored', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "active", "ignored", or "resolved"' },
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
      console.error('[BulkIssueStatus] Error fetching audit:', auditErr)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Bulk update issues
    const { data: updatedIssues, error: updateErr } = await (supabaseAdmin as any)
      .from('issues')
      .update({ 
        status: status as IssueStatus, 
        updated_at: new Date().toISOString() 
      })
      .eq('audit_id', auditId)
      .in('id', issueIds)
      .select()

    if (updateErr) {
      console.error('[BulkIssueStatus] Error updating issues:', updateErr)
      return NextResponse.json({ error: 'Failed to update issues' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updated: updatedIssues?.length || 0,
      issues: updatedIssues || [],
    })
  } catch (error) {
    console.error('[BulkIssueStatus] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



