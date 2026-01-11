// fortress v1
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseAdmin } from "@/lib/supabase-admin"

type StripeMode = 'test' | 'live'

function getStripe() {
  const mode = (process.env.STRIPE_MODE as StripeMode) || 'test'
  const STRIPE_SECRET_KEY =
    mode === 'test' ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY
  
  if (!STRIPE_SECRET_KEY) {
    throw new Error(`Missing Stripe secret key for ${mode} mode`)
  }
  
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" })
}

export async function POST(request: Request) {
  const mode = (process.env.STRIPE_MODE as StripeMode) || 'test'
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const stripe = getStripe()
  try {
    let customerId: string | undefined
    try {
      const body = await request.json().catch(() => null)
      customerId = body?.customerId
    } catch {}

    // If no explicit customerId provided, resolve from authenticated user email
    if (!customerId) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
      if (!authHeader?.toLowerCase().startsWith('bearer ')) {
        return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
      }
      const token = authHeader.split(' ')[1]
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
      if (userError || !userData?.user?.email) {
        return NextResponse.json({ error: 'Invalid token or email' }, { status: 401 })
      }
      const email = userData.user.email

      // Search for an existing Stripe customer by email
      const search = await stripe.customers.search({
        query: `email:\"${email}\"`,
        limit: 1,
      })
      const found = search.data?.[0]
      if (!found?.id) {
        return NextResponse.json({ error: 'No Stripe customer found for this user' }, { status: 404 })
      }
      customerId = found.id
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId!,
      return_url: `${APP_URL}/dashboard`,
    })

    return NextResponse.json({ url: portal.url })
  } catch (err: any) {
    console.error('[Stripe] portal error:', err?.message)
    return NextResponse.json({ error: err?.message || 'Failed to create portal session' }, { status: 500 })
  }
}


