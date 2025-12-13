/**
 * Stripe test helpers
 * Utilities for creating mock Stripe events and test data
 */

import Stripe from 'stripe'

// Get Stripe test secret key from environment
const STRIPE_TEST_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY
const STRIPE_TEST_WEBHOOK_SECRET = process.env.STRIPE_TEST_WEBHOOK_SECRET

if (!STRIPE_TEST_SECRET_KEY) {
  throw new Error('STRIPE_TEST_SECRET_KEY is required for Stripe tests')
}

const stripe = new Stripe(STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

/**
 * Create a test Stripe customer
 */
export async function createTestCustomer(email: string, name?: string) {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      test: 'true',
    },
  })
  return customer
}

/**
 * Delete a test Stripe customer
 */
export async function deleteTestCustomer(customerId: string) {
  try {
    await stripe.customers.del(customerId)
  } catch (error) {
    // Customer may already be deleted
    console.warn(`Failed to delete test customer ${customerId}:`, error)
  }
}

/**
 * Create a test Stripe subscription
 */
export async function createTestSubscription(
  customerId: string,
  priceId: string
) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: {
      test: 'true',
    },
  })
  return subscription
}

/**
 * Cancel a test Stripe subscription
 */
export async function cancelTestSubscription(subscriptionId: string) {
  try {
    await stripe.subscriptions.cancel(subscriptionId)
  } catch (error) {
    console.warn(`Failed to cancel test subscription ${subscriptionId}:`, error)
  }
}

/**
 * Create a mock Stripe checkout session object
 */
export function createMockCheckoutSession(
  overrides?: Partial<Stripe.Checkout.Session>
): Stripe.Checkout.Session {
  const sessionId = overrides?.id || `cs_test_${Date.now()}`
  const customerId = overrides?.customer || `cus_test_${Date.now()}`
  const subscriptionId = overrides?.subscription || `sub_test_${Date.now()}`

  return {
    id: sessionId,
    object: 'checkout.session',
    amount_subtotal: overrides?.amount_subtotal || 2900,
    amount_total: overrides?.amount_total || 2900,
    currency: overrides?.currency || 'usd',
    customer: customerId,
    customer_details: overrides?.customer_details || {
      email: 'test@example.com',
      name: 'Test User',
    },
    mode: overrides?.mode || 'subscription',
    payment_status: overrides?.payment_status || 'paid',
    status: overrides?.status || 'complete',
    subscription: subscriptionId,
    metadata: overrides?.metadata || {
      plan: 'pro',
      created_at: new Date().toISOString(),
      email_capture_token: '',
    },
    success_url: overrides?.success_url || 'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=pro',
    cancel_url: overrides?.cancel_url || 'http://localhost:3000/preview',
    consent: overrides?.consent || {
      promotions: 'opt_in',
    },
    after_expiration: overrides?.after_expiration || {
      recovery: {
        enabled: true,
        expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        url: 'http://localhost:3000/brand-details?fromExtraction=true',
      },
    },
    // Add other required fields with defaults
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    url: null,
    ...overrides,
  } as Stripe.Checkout.Session
}

/**
 * Create a mock Stripe subscription object
 */
export function createMockSubscription(
  overrides?: Partial<Stripe.Subscription>
): Stripe.Subscription {
  const subscriptionId = overrides?.id || `sub_test_${Date.now()}`
  const customerId = overrides?.customer || `cus_test_${Date.now()}`
  const currentPeriodEnd = overrides?.current_period_end || Math.floor(Date.now() / 1000) + 2592000 // 30 days

  return {
    id: subscriptionId,
    object: 'subscription',
    customer: customerId,
    status: overrides?.status || 'active',
    current_period_end: currentPeriodEnd,
    current_period_start: Math.floor(Date.now() / 1000),
    latest_invoice: overrides?.latest_invoice || `in_test_${Date.now()}`,
    items: {
      object: 'list',
      data: [],
      has_more: false,
      url: '',
    },
    metadata: {
      test: 'true',
      ...overrides?.metadata,
    },
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Stripe.Subscription
}

/**
 * Create a mock Stripe event with valid signature
 */
export async function createMockStripeEvent(
  eventType: string,
  data: any,
  overrides?: Partial<Stripe.Event>
): Promise<Stripe.Event> {
  const eventId = overrides?.id || `evt_test_${Date.now()}`

  return {
    id: eventId,
    object: 'event',
    type: eventType,
    data: {
      object: data,
    },
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    api_version: '2023-10-16',
    pending_webhooks: 0,
    request: {
      id: `req_test_${Date.now()}`,
      idempotency_key: null,
    },
    ...overrides,
  } as Stripe.Event
}

/**
 * Generate a valid Stripe webhook signature using Stripe SDK
 * Uses Stripe's generateTestHeaderString method (official SDK method)
 */
export async function generateWebhookSignature(
  payload: string | Buffer,
  secret: string = STRIPE_TEST_WEBHOOK_SECRET || ''
): Promise<string> {
  if (!secret) {
    throw new Error('STRIPE_TEST_WEBHOOK_SECRET is required to generate webhook signatures')
  }

  const payloadString = typeof payload === 'string' ? payload : payload.toString()
  
  // Use Stripe SDK's official generateTestHeaderString method
  // This is the recommended way to generate test webhook signatures
  return stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret,
  })
}

/**
 * Create a mock webhook request with valid signature
 */
export async function createMockWebhookRequest(
  event: Stripe.Event
): Promise<{ body: Buffer; signature: string }> {
  const payload = JSON.stringify(event)
  const payloadBuffer = Buffer.from(payload)
  const signature = await generateWebhookSignature(payloadBuffer)

  return {
    body: payloadBuffer,
    signature,
  }
}

/**
 * Clean up test Stripe resources
 */
export async function cleanupTestStripeResources(
  customerId?: string,
  subscriptionId?: string
) {
  if (subscriptionId) {
    await cancelTestSubscription(subscriptionId)
  }
  if (customerId) {
    await deleteTestCustomer(customerId)
  }
}

