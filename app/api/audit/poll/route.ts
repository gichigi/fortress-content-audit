// Poll background audit status (for paid/enterprise tiers)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pollAuditStatus, AuditTier } from '@/lib/audit'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}))
    const { responseId, runId } = body || {}

    if (!responseId) {
      return NextResponse.json({ error: 'Missing responseId' }, { status: 400 })
    }

    // Retrieve tier from database if runId is provided
    let tier: AuditTier | undefined = undefined
    if (runId) {
      const { data: auditRun } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('issues_json')
        .eq('id', runId)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (auditRun?.issues_json && typeof auditRun.issues_json === 'object' && 'tier' in auditRun.issues_json) {
        const storedTier = (auditRun.issues_json as any).tier
        // Validate tier is a valid AuditTier
        if (storedTier === 'FREE' || storedTier === 'PAID' || storedTier === 'ENTERPRISE') {
          tier = storedTier as AuditTier
          console.log(`[Poll] Retrieved tier ${tier} from database for runId: ${runId}`)
        }
      }
    }

    console.log(`[Poll] Checking status for responseId: ${responseId}${tier ? ` (tier: ${tier})` : ''}`)
    const result = await pollAuditStatus(responseId, tier)

    // If still in progress, return status with progress info
    if (result.status === 'in_progress') {
      return NextResponse.json({
        status: 'in_progress',
        responseId,
        message: 'Audit is still running. Check back in a few seconds.',
        progress: {
          pagesScanned: result.pagesScanned || 0,
          issuesFound: result.groups?.length || 0,
        },
      })
    }

    // Audit completed - update the database record if we have a runId
    if (runId) {
      const issuesJson = {
        groups: result.groups,
        auditedUrls: result.auditedUrls || [],
        tier: result.tier || tier, // Preserve tier for future lookups
      }

      const { error: updateErr } = await supabaseAdmin
        .from('brand_audit_runs')
        .update({
          pages_scanned: result.pagesScanned,
          issues_json: issuesJson,
        })
        .eq('id', runId)
        .eq('user_id', userId)

      if (updateErr) {
        console.error('[Poll] Failed to update audit run:', updateErr)
      } else {
        console.log(`[Poll] Updated audit run: ${runId}`)
      }
    }

    // Return completed results
    return NextResponse.json({
      status: 'completed',
      runId,
      groups: result.groups,
      totalIssues: result.groups.length,
      meta: {
        pagesScanned: result.pagesScanned,
        auditedUrls: result.auditedUrls || [],
        tier: result.tier,
      },
    })
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error')
    console.error('[Poll] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

