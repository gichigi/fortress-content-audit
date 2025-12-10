// fortress v1
import { NextResponse } from "next/server"
import Stripe from "stripe"
import PostHogClient from "@/lib/posthog"

type StripeMode = 'test' | 'live'
const mode = (process.env.STRIPE_MODE as StripeMode) || 'test'
const STRIPE_SECRET_KEY =
  mode === 'test' ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY

const stripe = new Stripe(STRIPE_SECRET_KEY!)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const PRO_PRICE_ID =
  mode === 'test' ? process.env.STRIPE_TEST_PRO_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID

export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    // Optional body for future use (e.g., emailCaptureToken)
    let emailCaptureToken: string | undefined
    try {
      const body = await request.json().catch(() => null)
      emailCaptureToken = body?.emailCaptureToken
    } catch {}

    if (!PRO_PRICE_ID) {
      return NextResponse.json(
        { error: mode === 'test' ? 'Missing STRIPE_TEST_PRO_PRICE_ID' : 'Missing STRIPE_PRO_PRICE_ID' },
        { status: 500 }
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=pro`,
      cancel_url: `${APP_URL}/preview`,
      allow_promotion_codes: true,
      // Record email capture token for webhook reconciliation if present
      metadata: {
        email_capture_token: emailCaptureToken || '',
        created_at: new Date().toISOString(),
        plan: 'pro',
      },
    })

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