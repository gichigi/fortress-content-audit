# Stripe Payment Tests

Tests Stripe payment integration using **REAL Stripe test API calls** (not mocks). This ensures the integration works correctly and will work in production.

## Quick Setup

1. **Create test product/price:**
   ```bash
   pnpm tsx __tests__/helpers/setup-stripe-test-product.ts
   ```
   Add the price ID to `.env.local`: `STRIPE_TEST_PRO_PRICE_ID=price_...`

2. **Get webhook secret:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```
   Add to `.env.local`: `STRIPE_TEST_WEBHOOK_SECRET=whsec_...`

3. **Run tests:**
   ```bash
   pnpm test __tests__/stripe-payment.test.ts
   ```

## What's Tested

✅ **Real Stripe API calls:** checkout sessions, customers, subscriptions, webhooks  
✅ **Real database operations:** profiles, email_captures  
✅ **Webhook signature verification:** Stripe SDK  
✅ **Email service:** mocked (no real emails)  
✅ **PostHog:** mocked (no real events)

## Test Coverage

- Checkout session creation
- Webhook signature verification
- Webhook event processing (payment, subscription events)
- Plan activation/database updates
- Billing portal
- Email integration
- Error handling

See `stripe-payment.test.ts` for full test implementation.
