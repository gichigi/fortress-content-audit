// fortress v1
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { emailService } from "@/lib/email-service"
import { supabaseAdmin } from "@/lib/supabase-admin"

// Pick the right Stripe secret key and webhook secret based on STRIPE_MODE
type StripeMode = 'test' | 'live';
const mode = (process.env.STRIPE_MODE as StripeMode) || 'test';
const STRIPE_SECRET_KEY =
  mode === 'test'
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET =
  mode === 'test'
    ? process.env.STRIPE_TEST_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
})

// Helper function to check if email has been sent (using database)
async function hasEmailBeenSent(emailKey: string): Promise<boolean> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from('email_captures')
      .select('id')
      .eq('session_token', emailKey)
      .maybeSingle()
    return !!data
  } catch (error) {
    console.error('Error checking email sent status:', error)
    return false
  }
}

// Helper function to mark email as sent
async function markEmailAsSent(emailKey: string, email: string): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('email_captures')
      .upsert({
        session_token: emailKey,
        email: email,
        abandoned_email_sent: emailKey.startsWith('abandoned_'),
        payment_completed: emailKey.startsWith('thankyou_'),
      }, {
        onConflict: 'session_token'
      })
  } catch (error) {
    console.error('Error marking email as sent:', error)
  }
}

// Generate discount code for abandoned cart recovery
function generateDiscountCode(): string {
  return 'COMEBACK20';
}

// Log webhook event details for debugging
function logWebhookDetails(event: any, error?: any) {
  const timestamp = new Date().toISOString()
  const eventId = event?.id || 'unknown'
  const eventType = event?.type || 'unknown'
  
  console.log(`[${timestamp}] Webhook ${eventId} (${eventType}): ${error ? 'FAILED' : 'SUCCESS'}`)
  
  if (error) {
    console.error(`[${timestamp}] Error details:`, error.message)
  }
}

// Handle redirects from www to non-www domain
function normalizeWebhookUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // Check if this is the www version
    if (urlObj.hostname === 'www.aistyleguide.com') {
      urlObj.hostname = 'aistyleguide.com'
      console.log(`Normalized webhook URL from ${url} to ${urlObj.toString()}`)
      return urlObj.toString()
    }
    return url
  } catch (e) {
    console.error('Failed to normalize URL:', e)
    return url
  }
}

// Handle successful payment
async function handlePaymentSuccess(session: Stripe.Checkout.Session) {
  try {
    console.log('Processing successful payment:', session.id);
    
    // Extract customer details for personal follow-up email
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;
    const amount = session.amount_total || 0;
    const currency = session.currency || 'usd';
    
    if (!customerEmail) {
      console.log('No customer email found, skipping personal follow-up email');
      return;
    }
    
    // Check if we already sent a personal follow-up email for this session
    const emailKey = `thankyou_${session.id}`;
    if (await hasEmailBeenSent(emailKey)) {
      console.log('Personal follow-up email already sent for session:', session.id);
      return;
    }
    
    // Send personal follow-up email from Tahi
    // TEMP DISABLED: Subscription emails temporarily disabled
    console.log('⚠️ Subscription email temporarily disabled (skipping sendThankYouEmail)')
    // const emailResult = await emailService.sendThankYouEmail({
    //   customerEmail,
    //   customerName: customerName || undefined,
    //   sessionId: session.id,
    //   amount,
    //   currency,
    // });
    
    // if (emailResult.success) {
    //   await markEmailAsSent(emailKey, customerEmail);
    //   console.log('✅ Personal follow-up email sent successfully to:', customerEmail);
    // } else {
    //   console.error('❌ Failed to send personal follow-up email:', emailResult.error);
    // }
    
    // Mark email capture as payment completed to prevent abandoned cart emails
    const emailCaptureToken = session.metadata?.email_capture_token;
    if (emailCaptureToken) {
      console.log('📧 Marking email capture as payment completed:', emailCaptureToken.substring(0, 8) + '***');
      try {
        const captureResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/capture-email`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken: emailCaptureToken })
        });
        
        if (captureResponse.ok) {
          console.log('✅ Email capture marked as payment completed');
        } else {
          console.error('❌ Failed to mark email capture as completed:', await captureResponse.text());
        }
      } catch (error) {
        console.error('❌ Error updating email capture:', error);
      }
    }
    
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Handle expired session (abandoned cart)
async function handleSessionExpired(session: Stripe.Checkout.Session) {
  try {
    console.log('Processing expired session:', session.id);
    
    // Extract customer details and recovery info
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;
    const recoveryUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://aistyleguide.com'}/brand-details?fromExtraction=true`;
    const expiresAt = session.after_expiration?.recovery?.expires_at;
    
    // Check if customer consented to promotional emails
    const hasConsent = session.consent?.promotions === 'opt_in';
    
    if (!customerEmail || !recoveryUrl || !hasConsent) {
      console.log('Missing email, recovery URL, or consent - skipping abandoned cart email');
      console.log('Email:', !!customerEmail, 'Recovery URL:', !!recoveryUrl, 'Consent:', hasConsent);
      return;
    }
    
    // Check if we already sent an abandoned cart email for this customer
    const emailKey = `abandoned_${customerEmail}`;
    if (await hasEmailBeenSent(emailKey)) {
      console.log('Abandoned cart email already sent to:', customerEmail);
      return;
    }
    
    // Generate discount code
    const discountCode = generateDiscountCode();
    
    // Send abandoned cart recovery email
    console.log('🔄 Sending abandoned cart email...')
    const emailResult = await emailService.sendAbandonedCartEmail({
      customerEmail,
      customerName: customerName || undefined,
      recoveryUrl,
      discountCode,
      sessionId: session.id,
    });
    
    if (emailResult.success) {
      await markEmailAsSent(emailKey, customerEmail);
      console.log('✅ Abandoned cart email sent successfully to:', customerEmail);
      console.log('🎯 Discount code:', discountCode);
    } else {
      console.error('❌ Failed to send abandoned cart email:', emailResult.error);
    }
    
  } catch (error) {
    console.error('Error handling session expiration:', error);
  }
}

export async function POST(request: Request) {
  // Get the original URL
  const originalUrl = request.url
  // Normalize the URL for logging purposes
  const normalizedUrl = normalizeWebhookUrl(originalUrl)
  
  // Get raw buffer for signature verification (critical for Stripe webhooks)
  const payload = await request.arrayBuffer()
  const payloadBuffer = Buffer.from(payload)
  const sig = request.headers.get("stripe-signature")
  
  console.log(`[${new Date().toISOString()}] Webhook received:`)
  console.log(`  Original URL: ${originalUrl}`)
  console.log(`  Normalized URL: ${normalizedUrl}`)

  if (!sig) {
    console.error("Missing stripe-signature header")
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  try {
    // Verify webhook signature using raw buffer
    const event = stripe.webhooks.constructEvent(
      payloadBuffer,
      sig,
      STRIPE_WEBHOOK_SECRET!
    )

    // Log successful verification
    console.log(`Webhook verified: ${event.id} (${event.type})`)

    switch (event.type) {
      case "checkout.session.completed":
        // Handle successful payment
      console.log("Payment successful:", event.data.object.id)
      {
        const session = event.data.object as Stripe.Checkout.Session
        await handlePaymentSuccess(session)
        // If subscription checkout, set plan to pro
        if (session.mode === 'subscription' && session.subscription && session.customer) {
          try {
            await handleSubscriptionActive(session.subscription as string, session.customer as string)
          } catch (e) {
            console.error('Failed to set plan after subscription checkout:', e)
          }
        }
      }
        break
        
      case "checkout.session.async_payment_succeeded":
        // Handle delayed payment success (bank transfers, etc.)
        console.log("Async payment successful:", event.data.object.id)
        await handlePaymentSuccess(event.data.object as Stripe.Checkout.Session)
        break
        
      case "checkout.session.expired":
        // Handle expired session (abandoned cart)
        console.log("Session expired:", event.data.object.id)
        await handleSessionExpired(event.data.object as Stripe.Checkout.Session)
        break
        
      case "customer.subscription.created":
      case "customer.subscription.updated":
        try {
          const sub = event.data.object as Stripe.Subscription
          if (sub.status === 'active') {
            await handleSubscriptionActive(sub.id, sub.customer as string)
          }
        } catch (e) {
          console.error('Subscription create/update handling failed:', e)
        }
        break
        
      case "customer.subscription.deleted":
        try {
          const sub = event.data.object as Stripe.Subscription
          await setPlanFree(sub.customer as string)
        } catch (e) {
          console.error('Subscription deletion handling failed:', e)
        }
        break
        
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Log successful processing
    logWebhookDetails(event)
    
    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("Webhook error:", err.message)
    
    // Log webhook processing failure
    try {
      // Try to parse the event even if signature verification failed
      const event = JSON.parse(payloadBuffer.toString())
      logWebhookDetails(event, err)
    } catch (parseErr) {
      console.error("Could not parse webhook payload:", parseErr)
    }
    
    return NextResponse.json({ 
      error: "Webhook handler failed", 
      message: err.message,
      url: normalizedUrl
    }, { status: 400 })
  }
} 

async function handleSubscriptionActive(subscriptionId: string, customerId: string) {
  const stripeLocal = new Stripe(
    (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)!,
    { apiVersion: "2025-03-31.basil" }
  )
  const sub = await stripeLocal.subscriptions.retrieve(subscriptionId)
  const periodEnd =
    (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null

  // Try to get email from invoice first (more reliable)
  let email: string | null = null
  try {
    if (sub.latest_invoice) {
      const inv = await stripeLocal.invoices.retrieve(sub.latest_invoice as string)
      email = inv?.customer_email || null
    }
    if (!email) {
      const customer = await stripeLocal.customers.retrieve(customerId as string)
      if (!('deleted' in customer) && customer.email) email = customer.email
    }
  } catch (e) {
    console.error('Failed to resolve subscription customer email:', e)
  }

  if (!email) {
    console.warn('No email found to update profile plan.')
    return
  }

  // Resolve user_id from auth.users by email using Admin Auth API
  let userId: string | null = null
  try {
    const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) {
      console.error('Failed to list users:', listErr.message)
      return
    }
    const authUser = usersData?.users?.find(u => u.email === email)
    if (!authUser?.id) {
      console.error('Could not resolve user_id for email:', email)
      return
    }
    userId = authUser.id
  } catch (e) {
    console.error('Error resolving user by email:', e)
    return
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        plan: 'pro',
        current_period_end: periodEnd,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      },
      { onConflict: 'user_id' }
    )
  if (error) {
    console.error('Failed to update profile to pro:', error.message)
  } else {
    console.log('Profile upgraded to pro for user_id:', userId)
  }
}

async function setPlanFree(customerId: string) {
  try {
    const stripeLocal = new Stripe(
      (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)!,
      { apiVersion: "2025-03-31.basil" }
    )
    const customer = await stripeLocal.customers.retrieve(customerId)
    if (!('deleted' in customer) && customer.email) {
      // Resolve user_id from auth.users by email using Admin Auth API
      let userId: string | null = null
      try {
        const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
        if (listErr) {
          console.error('Failed to list users:', listErr.message)
          return
        }
        const authUser = usersData?.users?.find(u => u.email === customer.email)
        if (!authUser?.id) {
          console.error('Could not resolve user_id for email:', customer.email)
          return
        }
        userId = authUser.id
      } catch (e) {
        console.error('Error resolving user by email:', e)
        return
      }
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ plan: 'free', current_period_end: null, stripe_subscription_id: null })
        .eq('user_id', userId)
      if (error) {
        console.error('Failed to downgrade profile to free:', error.message)
      } else {
        console.log('Profile downgraded to free for user_id:', userId)
      }
    }
  } catch (e) {
    console.error('Failed to downgrade on subscription delete:', e)
  }
}