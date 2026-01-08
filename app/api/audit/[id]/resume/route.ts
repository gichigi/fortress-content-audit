// DEPRECATED: Resume failed or interrupted audit by polling the responseId
// This endpoint is deprecated as of the GPT-5.1 unified audit refactor.
// All audits now complete synchronously - no background execution or resuming needed.
// Kept temporarily for legacy audits that may still be in progress.
// TODO: Remove this endpoint after transition period (30 days from refactor date).
//
// Resume failed or interrupted audit by polling the responseId
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pollAuditStatus, AuditTier } from '@/lib/audit'
import Logger from '@/lib/logger'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Log deprecation warning
  console.warn('[Resume] DEPRECATED: Resume endpoint called. All audits now complete synchronously.')
  
  try {
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 })
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
      Logger.error('[Resume] Error fetching audit', fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr)))
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    if (!auditRun) {
      return NextResponse.json({ error: 'The requested audit was not found.' }, { status: 404 })
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
          pagesAudited: result.pagesAudited || 0,
          issuesFound: result.issues?.length || 0,
        },
      })
    }

    // If completed, update the database
    if (result.status === 'completed') {
      const filteredIssues = result.issues || []

      const updatedIssuesJson = {
        issues: filteredIssues,
        auditedUrls: result.auditedUrls || [],
        tier: result.tier || tier || 'PAID', // Preserve tier for future lookups
      }

      const { error: updateErr } = await supabaseAdmin
        .from('brand_audit_runs')
        .update({
          pages_audited: result.pagesAudited,
          issues_json: updatedIssuesJson,
        })
        .eq('id', id)
        .eq('user_id', userId)

      if (updateErr) {
        console.error('[Resume] Failed to update audit run:', updateErr)
        return NextResponse.json({ error: 'Something went wrong updating the audit. Please try again.' }, { status: 500 })
      }

      // Save issues to issues table
      if (filteredIssues.length > 0) {
        try {
          const issuesToInsert = filteredIssues.map((issue) => ({
            audit_id: id,
            page_url: issue.page_url,
            category: issue.category || null,
            issue_description: issue.issue_description,
            severity: issue.severity,
            suggested_fix: issue.suggested_fix,
            status: 'active', // All new issues start as active
          }))

          const { error: issuesErr } = await (supabaseAdmin as any)
            .from('issues')
            .insert(issuesToInsert)

          if (issuesErr) {
            console.error('[Resume] Failed to save issues:', issuesErr)
            // Don't fail the request - issues are critical but we have issues_json as backup
          } else {
            console.log(`[Resume] Saved ${issuesToInsert.length} issues to issues table`)
          }
        } catch (error) {
          console.error('[Resume] Error saving issues:', error)
          // Don't fail the request
        }
      }

      return NextResponse.json({
        status: 'completed',
        message: 'Audit completed successfully.',
        issues: filteredIssues,
        totalIssues: filteredIssues.length,
        meta: {
          pagesAudited: result.pagesAudited,
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
    Logger.error('[Resume] Error', error, {
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    })
    // Return user-friendly message (error.message is already sanitized by handleAuditError if it came from audit)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

