// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
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
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
      console.error('[Audit] Error fetching issues:', issuesErr)
      console.error('[Audit] Audit ID:', id)
      throw issuesErr
    }

    // If no issues found, return empty array (no fallback to issues_json)
    if (!issues || issues.length === 0) {
      return NextResponse.json({
        runId: run.id,
        preview: plan === 'free',
        domain: run.domain,
        issues: [],
        totalIssues: 0,
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
      issues: gatedIssues,
      totalIssues: issues.length,
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch audit' },
      { status: 500 }
    )
  }
}


