// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAdvancedRulesJSON } from '@/lib/openai'

function bearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function POST(request: Request) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    if (!userData?.user?.id) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { name, audience, traits = [], language_tag = 'en-US', count = 25 } = body || {}
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('plan').eq('user_id', userData.user.id).maybeSingle()
    const plan = profile?.plan || 'free'

    const res = await generateAdvancedRulesJSON({ name, audience, traits, language_tag, count })
    if (!res.success || !res.content) {
      return NextResponse.json({ error: res.error || 'Generation failed' }, { status: 500 })
    }
    let rules: any[] = []
    try {
      const parsed = JSON.parse(res.content)
      rules = Array.isArray(parsed) ? parsed : [parsed]
    } catch { rules = [] }

    const gated = plan === 'free' ? rules.slice(0, Math.min(5, rules.length)) : rules.slice(0, count)
    return NextResponse.json({ rules: gated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}


