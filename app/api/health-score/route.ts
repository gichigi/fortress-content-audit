// fortress v1 - Health Score API
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { AuditRun } from '@/types/fortress'
import { calculateHealthScore, calculateAggregatedHealthScore } from '@/lib/health-score'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

/**
 * GET /api/health-score
 * 
 * Returns health score history for a domain over time
 * 
 * Query params:
 * - domain (optional): Domain to calculate score for (defaults to most recent audit)
 * - days (optional): Time range in days (30/60/90, default 30)
 */
export async function GET(request: Request) {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const domainParam = searchParams.get('domain')
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam, 10) : 30
    
    // Validate days
    if (isNaN(days) || ![30, 60, 90].includes(days)) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be 30, 60, or 90' },
        { status: 400 }
      )
    }

    // Calculate date range (UTC)
    const now = new Date()
    const startDate = new Date(now)
    startDate.setUTCDate(startDate.getUTCDate() - days)
    startDate.setUTCHours(0, 0, 0, 0)

    let domain = domainParam

    // If no domain specified, get most recent audit's domain
    if (!domain) {
      const { data: recentAudit } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('domain')
        .eq('user_id', userId)
        .not('domain', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!recentAudit?.domain) {
        return NextResponse.json({
          data: [],
          currentScore: null,
          message: 'No audits found. Run an audit to see health score.',
        })
      }
      domain = recentAudit.domain
    }

    // Normalize domain (remove protocol, www, trailing slash)
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

    // Fetch earliest audit for this domain to calculate baseline date
    const { data: earliestAudit } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('created_at')
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)
      .not('created_at', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Fetch audits for domain within time range
    const { data: audits, error: auditsError } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('*')
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (auditsError) {
      console.error('[HealthScore] Error fetching audits:', auditsError)
      return NextResponse.json(
        { error: 'Failed to fetch audits' },
        { status: 500 }
      )
    }

    if (!audits || audits.length === 0) {
      return NextResponse.json({
        data: [],
        currentScore: null,
        message: `No audits found for ${normalizedDomain} in the last ${days} days.`,
      })
    }

    // Calculate health score for each audit date
    // Group audits by date (same day audits use aggregated score)
    const scoresByDate = new Map<string, { date: string; score: number; metrics: any }>()
    
    // Group audits by date (YYYY-MM-DD)
    const auditsByDate = new Map<string, AuditRun[]>()
    audits.forEach((audit) => {
      if (!audit.created_at) return
      const auditDate = new Date(audit.created_at)
      const dateKey = auditDate.toISOString().split('T')[0] // YYYY-MM-DD
      
      if (!auditsByDate.has(dateKey)) {
        auditsByDate.set(dateKey, [])
      }
      auditsByDate.get(dateKey)!.push(audit as AuditRun)
    })

    // Calculate score for each date
    for (const [dateKey, dateAudits] of auditsByDate.entries()) {
      // Use aggregated calculation for multiple audits on same day
      // Note: calculateAggregatedHealthScore now uses issues table directly, no ignoredSignatures needed
      const result = await calculateAggregatedHealthScore(dateAudits)
      
      scoresByDate.set(dateKey, {
        date: dateKey,
        score: result.score,
        metrics: result.metrics,
      })
    }

    // Convert to array and sort by date
    const data = Array.from(scoresByDate.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    )

    // Inject persistent baseline (day before earliest audit)
    if (earliestAudit?.created_at && data.length > 0) {
      const earliestDate = new Date(earliestAudit.created_at)
      const baselineDate = new Date(earliestDate)
      baselineDate.setUTCDate(baselineDate.getUTCDate() - 1)
      baselineDate.setUTCHours(0, 0, 0, 0)
      const baselineDateKey = baselineDate.toISOString().split('T')[0] // YYYY-MM-DD

      // Only add baseline if it's within the time range and not already in data
      const now = new Date()
      if (baselineDate >= startDate && baselineDate <= now && !scoresByDate.has(baselineDateKey)) {
        data.unshift({
          date: baselineDateKey,
          score: 100,
          metrics: {
            totalActive: 0,
            totalCritical: 0,
            bySeverity: { low: 0, medium: 0, high: 0 },
            criticalPages: 0,
            pagesWithIssues: 0,
          },
          isBaseline: true,
        })
        // Re-sort after adding baseline
        data.sort((a, b) => a.date.localeCompare(b.date))
      }
    }

    // Calculate current score (most recent audit or aggregated if multiple on same day)
    const latestDate = data.length > 0 ? data[data.length - 1].date : null
    const currentScore = latestDate ? scoresByDate.get(latestDate) : null

    return NextResponse.json({
      data,
      currentScore: currentScore ? {
        score: currentScore.score,
        date: currentScore.date,
        metrics: currentScore.metrics,
      } : null,
      domain: normalizedDomain,
      days,
    })
  } catch (e) {
    console.error('[HealthScore] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to calculate health score' },
      { status: 500 }
    )
  }
}

