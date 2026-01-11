# Production Deployment Checklist (Stripe Test Mode)

## Stripe Webhook Configuration

### Step 1: Create Webhook Endpoint in Stripe Dashboard
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Set **Endpoint URL**: `https://yourdomain.com/api/webhook`
4. Select events to listen for:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. **Copy the Signing secret** (starts with `whsec_...`) - you'll need this for env vars

### Step 2: Set Production Environment Variables

Add these to your hosting platform (Vercel, Railway, etc.):

```bash
# Stripe Configuration (Test Mode)
STRIPE_MODE=test
STRIPE_TEST_SECRET_KEY=sk_test_... (your test secret key)
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_... (your test publishable key)
STRIPE_TEST_WEBHOOK_SECRET=whsec_... (from step 1 - different from local!)
STRIPE_TEST_PRO_PRICE_ID=price_... (your test price ID)

# App URLs
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Supabase (keep existing)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Step 3: Test Webhook

1. Go to your webhook endpoint in Stripe Dashboard
2. Click **"Send test webhook"**
3. Select `checkout.session.completed`
4. Check your server logs to verify it received and processed the event

### Step 4: Test Full Flow

1. Deploy your app
2. Sign up a test user
3. Complete a test checkout
4. Verify:
   - ✅ Webhook is received (check Stripe Dashboard → Webhooks → latest delivery)
   - ✅ User plan updated to 'pro' in database
   - ✅ Dashboard shows Pro features (no "Upgrade to Pro" button)
   - ✅ Payment success email sent

## Important Notes

- **Webhook secret is different** for production vs local `stripe listen`
- **Keep `STRIPE_MODE=test`** to use test keys (no real charges)
- **Test mode webhooks** are sent immediately (no delays)
- **Monitor webhook deliveries** in Stripe Dashboard for debugging

## Status
- ✅ Environment variables configured in Vercel
- ✅ Webhook endpoint configured in Stripe
- ✅ Deployment successful

## Troubleshooting

**Webhook not received?**
- Check endpoint URL is correct
- Verify webhook secret matches Stripe Dashboard
- Check server logs for errors
- Test endpoint is publicly accessible (not behind firewall)

**Webhook received but plan not updated?**
- Check server logs for errors
- Verify user email matches between Stripe and Supabase
- Check webhook event type matches what you're listening for

**Plan updated but UI not refreshing?**
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Check if `paymentSuccess` event is firing in browser console
- Verify `NEXT_PUBLIC_APP_URL` is set correctly

