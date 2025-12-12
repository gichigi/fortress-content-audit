// Resume failed or interrupted audit by polling the responseId
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pollAuditStatus, AuditTier } from '@/lib/audit'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params

    // Fetch the audit run
    const { data: auditRun, error: fetchErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('issues_json, domain')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[Resume] Error fetching audit:', fetchErr)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!auditRun) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Check if responseId exists in issues_json
    const issuesJson = auditRun.issues_json as any
    const responseId = issuesJson?.responseId

    if (!responseId || typeof responseId !== 'string') {
      return NextResponse.json(
        { error: 'No responseId found. This audit cannot be resumed.' },
        { status: 400 }
      )
    }

    // Retrieve tier from issues_json if available
    let tier: AuditTier | undefined = undefined
    if (issuesJson?.tier) {
      const storedTier = issuesJson.tier
      if (storedTier === 'FREE' || storedTier === 'PAID' || storedTier === 'ENTERPRISE') {
        tier = storedTier as AuditTier
      }
    }

    console.log(`[Resume] Resuming audit ${id} with responseId: ${responseId}`)

    // Poll the status
    const result = await pollAuditStatus(responseId, tier)

    // If still in progress, return status
    if (result.status === 'in_progress') {
      return NextResponse.json({
        status: 'in_progress',
        responseId,
        message: 'Audit is running. Poll for status updates.',
        progress: {
          pagesScanned: result.pagesScanned || 0,
          issuesFound: result.groups?.length || 0,
        },
      })
    }

    // If completed, update the database
    if (result.status === 'completed') {
      const updatedIssuesJson = {
        groups: result.groups,
        auditedUrls: result.auditedUrls || [],
        tier: result.tier || tier || 'PAID', // Preserve tier for future lookups
      }

      const { error: updateErr } = await supabaseAdmin
        .from('brand_audit_runs')
        .update({
          pages_scanned: result.pagesScanned,
          issues_json: updatedIssuesJson,
        })
        .eq('id', id)
        .eq('user_id', userId)

      if (updateErr) {
        console.error('[Resume] Failed to update audit run:', updateErr)
        return NextResponse.json({ error: 'Failed to update audit' }, { status: 500 })
      }

      return NextResponse.json({
        status: 'completed',
        message: 'Audit completed successfully.',
        groups: result.groups,
        totalIssues: result.groups.length,
        meta: {
          pagesScanned: result.pagesScanned,
          auditedUrls: result.auditedUrls || [],
        },
      })
    }

    // Failed
    return NextResponse.json(
      { error: 'Audit job failed. Please try running a new audit.' },
      { status: 500 }
    )
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error')
    console.error('[Resume] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

