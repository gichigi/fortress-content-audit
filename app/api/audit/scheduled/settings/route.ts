// Settings endpoint for managing auto weekly audits
// Allows users to enable/disable auto audits per domain
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

/**
 * GET /api/audit/scheduled/settings
 * Get scheduled audit settings for a user's domains
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

    // Get all scheduled audits for this user
    const { data: scheduledAudits, error } = await supabaseAdmin
      .from('scheduled_audits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ScheduledSettings] Error fetching scheduled audits:', error)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled audits' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      scheduledAudits: scheduledAudits || [],
    })

  } catch (error) {
    console.error('[ScheduledSettings] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/audit/scheduled/settings
 * Create or update scheduled audit settings for a domain
 */
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

    // Check user plan - only pro and enterprise can use auto audits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()

    const plan = profile?.plan || 'free'
    console.log('[ScheduledSettings] User plan check:', { userId, plan, email: userData.user.email })
    if (plan !== 'pro' && plan !== 'enterprise') {
      return NextResponse.json(
        { 
          error: 'Auto weekly audits are only available for Pro and Enterprise plans',
          currentPlan: plan
        },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { domain, enabled } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      )
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled must be a boolean' },
        { status: 400 }
      )
    }

    // Normalize domain (remove protocol, www, trailing slash)
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

    // Calculate next_run date (7 days from now, Monday at 9 AM UTC)
    let nextRun: string | null = null
    if (enabled) {
      const nextRunDate = new Date()
      // Find next Monday
      const daysUntilMonday = (8 - nextRunDate.getUTCDay()) % 7 || 7
      nextRunDate.setUTCDate(nextRunDate.getUTCDate() + daysUntilMonday)
      nextRunDate.setUTCHours(9, 0, 0, 0)
      
      // If it's already past Monday 9 AM this week, schedule for next Monday
      if (nextRunDate <= new Date()) {
        nextRunDate.setUTCDate(nextRunDate.getUTCDate() + 7)
      }
      
      nextRun = nextRunDate.toISOString()
    }

    // Upsert scheduled audit setting
    const { data: scheduledAudit, error: upsertError } = await supabaseAdmin
      .from('scheduled_audits')
      .upsert(
        {
          user_id: userId,
          domain: normalizedDomain,
          enabled,
          next_run: nextRun,
        },
        {
          onConflict: 'user_id,domain',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()

    if (upsertError) {
      console.error('[ScheduledSettings] Error upserting scheduled audit:', upsertError)
      return NextResponse.json(
        { 
          error: 'Failed to save scheduled audit settings',
          details: upsertError.message,
          code: upsertError.code
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      scheduledAudit,
      message: enabled ? 'Auto weekly audits enabled' : 'Auto weekly audits disabled',
    })

  } catch (error) {
    console.error('[ScheduledSettings] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/audit/scheduled/settings
 * Delete scheduled audit settings for a domain
 */
export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain parameter is required' },
        { status: 400 }
      )
    }

    // Normalize domain
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

    // Delete scheduled audit
    const { error: deleteError } = await supabaseAdmin
      .from('scheduled_audits')
      .delete()
      .eq('user_id', userId)
      .eq('domain', normalizedDomain)

    if (deleteError) {
      console.error('[ScheduledSettings] Error deleting scheduled audit:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete scheduled audit settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Scheduled audit settings deleted',
    })

  } catch (error) {
    console.error('[ScheduledSettings] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

