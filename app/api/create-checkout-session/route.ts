// fortress v1
import { NextResponse } from "next/server"
import Stripe from "stripe"
import PostHogClient from "@/lib/posthog"
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
  const PRO_PRICE_ID =
    mode === 'test' ? process.env.STRIPE_TEST_PRO_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID
  const stripe = getStripe()
  const startTime = Date.now()
  try {
    // Optional body for future use (e.g., emailCaptureToken)
    let emailCaptureToken: string | undefined
    let userEmail: string | undefined
    let customerId: string | undefined
    
    try {
      const body = await request.json().catch(() => null)
      emailCaptureToken = body?.emailCaptureToken
    } catch {}

    // Try to get user email and customer ID from auth token
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.split(' ')[1]
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
      if (!userError && userData?.user?.email) {
        userEmail = userData.user.email
        
        // Get profile to check for existing Stripe customer
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id')
          .eq('user_id', userData.user.id)
          .maybeSingle()
        
        if (profileData?.stripe_customer_id) {
          customerId = profileData.stripe_customer_id
        }
      }
    }

    if (!PRO_PRICE_ID) {
      return NextResponse.json(
        { error: mode === 'test' ? 'Missing STRIPE_TEST_PRO_PRICE_ID' : 'Missing STRIPE_PRO_PRICE_ID' },
        { status: 500 }
      )
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${APP_URL}/dashboard?payment=success`,
      cancel_url: `${APP_URL}/account`,
      allow_promotion_codes: true,
      metadata: {
        email_capture_token: emailCaptureToken || '',
        created_at: new Date().toISOString(),
        plan: 'pro',
      },
    }

    // Pre-fill email if authenticated
    if (userEmail) {
      sessionConfig.customer_email = userEmail
    }

    // Reuse existing customer if available
    if (customerId) {
      sessionConfig.customer = customerId
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    console.log(`[Stripe] Subscription checkout session created: ${session.id}`)
    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    const duration = Date.now() - startTime
    const err = error instanceof Error ? error : new Error('Unknown error')
    console.error('[Stripe] create subscription error:', err.message)
    try {
      const posthog = PostHogClient()
      posthog.capture({
        distinctId: 'server',
        event: 'error_occurred',
        properties: {
          type: 'billing',
          message: err.message,
          endpoint: '/api/create-checkout-session',
          duration_ms: duration,
        }
      })
      posthog.shutdown()
    } catch {}
    return NextResponse.json(
      { error: err.message || 'Failed to create session' },
      { status: 500 }
    )
  }
}