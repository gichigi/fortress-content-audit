// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { auditSite } from '@/lib/audit'

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

    // Audit site with 20 pages for Pro rerun
    const result = await auditSite(run.domain, 20)

    const issuesJson = {
      groups: result.groups,
      top_findings: result.top_findings || [],
      summary: result.summary || '',
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .insert({
        user_id: userId,
        guideline_id: null,
        domain: run.domain,
        pages_scanned: result.pagesScanned,
        issues_json: issuesJson,
        is_preview: false,
      })
      .select('id')
      .maybeSingle()
    if (insErr) throw insErr

    return NextResponse.json({ 
      runId: inserted?.id, 
      groups: issuesJson.groups || [], 
      meta: { pagesScanned: result.pagesScanned } 
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Rerun failed' },
      { status: 500 }
    )
  }
}


