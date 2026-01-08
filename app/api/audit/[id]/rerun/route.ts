// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { auditSite } from '@/lib/audit'
import { checkDailyLimit, incrementAuditUsage, getAuditUsage } from '@/lib/audit-rate-limit'

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
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id
    const userEmail = userData.user.email || null
    const { id } = await params

    // Check plan
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()
    const plan = profile?.plan || 'free'
    if (plan !== 'pro') {
      return NextResponse.json({ error: 'Watchtower only' }, { status: 403 })
    }

    // Load run to get domain
    const { data: run, error: runErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('domain')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (runErr) throw runErr
    if (!run?.domain) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

    // Check daily audit limit for this domain (pass email for test account exception)
    const dailyCheck = await checkDailyLimit(userId, run.domain, plan, userEmail)
    if (!dailyCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Daily limit reached',
          message: `You've reached your daily limit of ${dailyCheck.limit} audit${dailyCheck.limit === 1 ? '' : 's'} for this domain. Try again tomorrow.`,
          limit: dailyCheck.limit,
          used: dailyCheck.used,
          resetAt: dailyCheck.resetAt,
        },
        { status: 429 }
      )
    }

    // Audit site for Pro rerun - all audits now complete synchronously
    const result = await auditSite(run.domain, 'PAID')

    // Ensure audit completed successfully
    if (result.status !== 'completed') {
      return NextResponse.json(
        { error: 'Audit did not complete successfully' },
        { status: 500 }
      )
    }

    const issuesJson = {
      issues: result.issues || [],
      auditedUrls: result.auditedUrls || [],
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .insert({
        user_id: userId,
        guideline_id: null,
        domain: run.domain,
        pages_audited: result.pagesAudited,
        issues_json: issuesJson,
        is_preview: false,
      })
      .select('id')
      .maybeSingle()
    if (insErr) throw insErr

    // Save issues to issues table
    if (inserted?.id && result.issues && result.issues.length > 0) {
      try {
        const issuesToInsert = result.issues.map((issue) => ({
          audit_id: inserted.id,
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
          console.error('[Rerun] Failed to save issues:', issuesErr)
          // Don't fail the request - issues are critical but we have issues_json as backup
        } else {
          console.log(`[Rerun] Saved ${issuesToInsert.length} issues to issues table`)
        }
      } catch (error) {
        console.error('[Rerun] Error saving issues:', error)
        // Don't fail the request
      }
    }

    // Increment audit usage after successful rerun
    if (inserted?.id) {
      try {
        await incrementAuditUsage(userId, run.domain)
      } catch (error) {
        console.error('[Rerun] Failed to increment audit usage:', error)
        // Don't fail the request - usage tracking is non-critical
      }
    }

    // Get usage info for response
    let usage = null
    try {
      usage = await getAuditUsage(userId, run.domain, plan)
    } catch (error) {
      console.error('[Rerun] Failed to get usage info:', error)
      // Don't fail the request - usage info is optional
    }

    return NextResponse.json({ 
      runId: inserted?.id, 
      issues: issuesJson.issues || [], 
      usage, // Include usage info
      meta: { pagesAudited: result.pagesAudited } 
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Rerun failed' },
      { status: 500 }
    )
  }
}


