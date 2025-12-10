// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTypographySuggestions } from '@/lib/openai'

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
    const { name, audience, traits = [], language_tag = 'en-US', count = 5 } = body || {}
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('plan').eq('user_id', userData.user.id).maybeSingle()
    const plan = profile?.plan || 'free'

    const res = await generateTypographySuggestions({ name, audience, traits, language_tag, count })
    if (!res.success || !res.content) {
      return NextResponse.json({ error: res.error || 'Generation failed' }, { status: 500 })
    }
    let items: any[] = []
    try { const parsed = JSON.parse(res.content); items = Array.isArray(parsed) ? parsed : [parsed] } catch { items = [] }
    const gated = plan === 'free' ? items.slice(0, Math.min(2, items.length)) : items.slice(0, count)
    return NextResponse.json({ suggestions: gated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}


