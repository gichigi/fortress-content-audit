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
  // Immediately await params to prevent Next.js 15 enumeration warnings
  const { id } = await params
  try {
    const token = getBearer(request)
    const url = new URL(request.url)
    const sessionToken = url.searchParams.get('session_token')
    
    let run: any = null
    let plan = 'free'
    
    // Try auth token first (for authenticated users)
    if (token) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
      if (!userErr && userData?.user?.id) {
        const userId = userData.user.id
        const { data, error } = await supabaseAdmin
          .from('brand_audit_runs')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw error
        run = data
        
        // Get plan for authenticated users
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('plan')
          .eq('user_id', userId)
          .maybeSingle()
        plan = profile?.plan || 'free'
      }
    }
    
    // Fallback to session token for unauthenticated users
    if (!run && sessionToken) {
      const { data, error } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('*')
        .eq('id', id)
        .eq('session_token', sessionToken)
        .maybeSingle()
      if (error) throw error
      run = data
      // Unauthenticated users are always free tier
      plan = 'free'
    }
    
    if (!run) {
      return NextResponse.json({ error: 'The requested audit was not found.' }, { status: 404 })
    }

    // Query issues from issues table (single source of truth)
    // Fetch ALL issues (active, ignored, resolved) - let client filter by status
    const { data: issues, error: issuesErr } = await (supabaseAdmin as any)
      .from('issues')
      .select('*')
      .eq('audit_id', id)
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

    // Determine if this is a preview (unauthenticated users always preview)
    const isPreview = !token || plan === 'free'
    
    // If no issues found, return empty array (no fallback to issues_json)
    if (!issues || issues.length === 0) {
      return NextResponse.json({
        runId: run.id,
        preview: isPreview,
        domain: run.domain,
        status: auditStatus,
        issues: [],
        totalIssues: 0,
        error: auditError,
        milestones: run.issues_json?.milestones || [],
        meta: {
          pagesAudited: run.pages_audited || run.pages_scanned || 0,
          pagesFound: run.pages_found || null,
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
    }

    // Authenticated users see all issues (no gating)
    // Gating only applies to unauthenticated homepage preview
    const gatedIssues = issues

    // Return issues from database (single source of truth)
    return NextResponse.json({
      runId: run.id,
      preview: isPreview,
      domain: run.domain,
      status: auditStatus,
      issues: gatedIssues,
      totalIssues: issues.length,
      error: auditError,
      milestones: run.issues_json?.milestones || [],
      meta: {
        pagesAudited: run.pages_audited || run.pages_scanned || 0,
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


