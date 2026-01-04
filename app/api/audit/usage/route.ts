// fortress v1 - Audit Usage API
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuditUsage } from '@/lib/audit-rate-limit'
import Logger from '@/lib/logger'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

/**
 * GET /api/audit/usage
 * 
 * Returns current audit usage info for the authenticated user
 * 
 * Query params:
 * - domain (optional): Domain to get usage for
 */
export async function GET(request: Request) {
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
    const userEmail = userData.user.email || null

    // Get plan
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()
    const plan = profile?.plan || 'free'

    // Parse query params
    const { searchParams } = new URL(request.url)
    const domainParam = searchParams.get('domain')

    // Get usage info (pass email for test account exception)
    const usage = await getAuditUsage(userId, domainParam || null, plan, userEmail)

    return NextResponse.json(usage)
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    Logger.error('[Usage] Error', error, {
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
    })
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}



