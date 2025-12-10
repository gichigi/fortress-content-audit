// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateKeywords } from '@/lib/openai'

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
    const { name, description, audience = 'general audience' } = body || {}
    if (!name || !description) {
      return NextResponse.json({ error: 'Missing name or description' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('plan').eq('user_id', userData.user.id).maybeSingle()
    const plan = profile?.plan || 'free'

    const res = await generateKeywords({ name, brandDetailsDescription: description, audience })
    if (!res.success || !res.content) {
      return NextResponse.json({ error: res.error || 'Generation failed' }, { status: 500 })
    }

    // Parse keywords JSON; gate count for free
    let parsed: any
    try { parsed = JSON.parse(res.content) } catch { parsed = { keywords: [] } }
    const kws = Array.isArray(parsed.keywords) ? parsed.keywords : []
    const gated = plan === 'free' ? kws.slice(0, 5) : kws

    return NextResponse.json({ keywords: gated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}


