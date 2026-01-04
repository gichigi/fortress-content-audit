// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Logger from '@/lib/logger'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getBearer(request)
    if (!token) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 })
    }
    const userId = userData.user.id
    const { id } = await params

    const { data: run, error } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (!run) return NextResponse.json({ error: 'The requested audit was not found.' }, { status: 404 })

    // Gating
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()
    const plan = profile?.plan || 'free'

    // Query issues from issues table (single source of truth)
    const { data: issues, error: issuesErr } = await (supabaseAdmin as any)
      .from('issues')
      .select('*')
      .eq('audit_id', id)
      .eq('status', 'active') // Only show active issues by default
      .order('severity', { ascending: false }) // High severity first
      .order('created_at', { ascending: true })

    if (issuesErr) {
      Logger.error('[Audit] Error fetching issues', issuesErr instanceof Error ? issuesErr : new Error(String(issuesErr)), {
        auditId: id,
        ...(process.env.NODE_ENV === 'development' ? { stack: issuesErr instanceof Error ? issuesErr.stack : undefined } : {})
      })
      throw issuesErr
    }

    // Get status from issues_json (pending, completed, failed)
    const auditStatus = run.issues_json?.status || 'pending'
    const auditError = run.issues_json?.error || null

    // If no issues found, return empty array (no fallback to issues_json)
    if (!issues || issues.length === 0) {
      return NextResponse.json({
        runId: run.id,
        preview: plan === 'free',
        domain: run.domain,
        status: auditStatus,
        issues: [],
        totalIssues: 0,
        error: auditError,
        meta: { 
          pagesScanned: run.pages_scanned, 
          createdAt: run.created_at,
          auditedUrls: run.issues_json?.auditedUrls || [],
        },
      })
    }

    // Authenticated users see all issues (no gating)
    // Gating only applies to unauthenticated homepage preview
    const gatedIssues = issues

    // Return issues from database (single source of truth)
    return NextResponse.json({
      runId: run.id,
      preview: false, // Authenticated users always see full results
      domain: run.domain,
      status: auditStatus,
      issues: gatedIssues,
      totalIssues: issues.length,
      error: auditError,
      meta: { 
        pagesScanned: run.pages_scanned, 
        createdAt: run.created_at,
        auditedUrls: run.issues_json?.auditedUrls || [],
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    Logger.error('[Audit] Error fetching audit', error, {
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    })
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}


