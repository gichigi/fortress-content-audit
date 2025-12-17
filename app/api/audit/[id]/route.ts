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

    // Query instances from audit_issues table
    const { data: instances, error: instancesErr } = await (supabaseAdmin as any)
      .from('audit_issues')
      .select('*')
      .eq('audit_id', id)
      .order('severity', { ascending: false }) // High severity first
      .order('created_at', { ascending: true })

    if (instancesErr) {
      console.error('[Audit] Error fetching instances:', instancesErr)
      // Fallback to issues_json for backward compatibility
      const groups = Array.isArray(run.issues_json?.groups) ? run.issues_json.groups : []
      const gatedGroups = plan === 'free' ? groups.slice(0, 5) : groups

      return NextResponse.json({
        runId: run.id,
        preview: plan === 'free',
        domain: run.domain,
        groups: gatedGroups,
        totalIssues: groups.length,
        meta: { 
          pagesScanned: run.pages_scanned, 
          createdAt: run.created_at,
          auditedUrls: run.issues_json?.auditedUrls || [],
        },
      })
    }

    // Get issue states for filtering
    const { data: issueStates } = await supabaseAdmin
      .from('audit_issue_states')
      .select('signature, state')
      .eq('user_id', userId)
      .eq('domain', run.domain || '')

    const statesMap = new Map<string, string>()
    issueStates?.forEach((s) => {
      if (s.signature && s.state) {
        statesMap.set(s.signature, s.state)
      }
    })

    // Filter out ignored instances
    const activeInstances = (instances || []).filter((instance) => {
      const state = statesMap.get(instance.signature)
      return state !== 'ignored'
    })

    // Apply gating for free plan
    const gatedInstances = plan === 'free' ? activeInstances.slice(0, 5) : activeInstances

    // For backward compatibility, also return groups (can be generated from instances)
    // But primary data is now instances
    return NextResponse.json({
      runId: run.id,
      preview: plan === 'free',
      domain: run.domain,
      instances: gatedInstances,
      totalIssues: activeInstances.length,
      meta: { 
        pagesScanned: run.pages_scanned, 
        createdAt: run.created_at,
        auditedUrls: run.issues_json?.auditedUrls || [],
      },
      // Legacy groups for backward compatibility (from issues_json if available)
      groups: Array.isArray(run.issues_json?.groups) ? run.issues_json.groups : [],
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch audit' },
      { status: 500 }
    )
  }
}


