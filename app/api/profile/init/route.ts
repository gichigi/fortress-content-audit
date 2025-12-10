// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const user = userData.user

    // Upsert to profiles(user_id) with default free plan
    const { error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          plan: 'free',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          current_period_end: null,
        },
        { onConflict: 'user_id' }
      )
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 }
    )
  }
}


