# Stripe Checkout Navigation & Migration Guide

## Current Checkout Entry Points

**Issue: No direct checkout button found**

Currently, users navigate to checkout indirectly:
1. **Dashboard → Account page** (`/account`)
   - Shows "Manage Billing" button
   - Opens Stripe Billing Portal (for existing customers)
   - **Problem:** No way to start a new subscription if user doesn't have one

2. **Dashboard → Upgrade prompts**
   - Shows "Upgrade to Pro" links in audit gating
   - Redirects to `/account` page
   - **Problem:** Account page doesn't have checkout button

3. **Missing:** Direct checkout flow for new subscriptions

## Best Practices Assessment

### ✅ What's Good
- Uses Stripe Checkout (hosted, secure)
- Supports promotion codes
- Proper success/cancel URLs
- Metadata tracking (email_capture_token, plan, created_at)
- Mode switching (test/live) via `STRIPE_MODE`

### ⚠️ Issues
1. **No checkout button for new subscriptions**
   - Account page only has "Manage Billing" (requires existing customer)
   - No way for free users to upgrade

2. **Inconsistent mode defaults**
   - `create-checkout-session`: defaults to `'test'`
   - `webhook`: defaults to `'live'`
   - **Risk:** Mismatch could cause issues

3. **Missing user context**
   - Checkout doesn't pre-fill customer email
   - No `customer` parameter (creates new customer each time)

## Test → Production Migration

### Easy Migration Path ✅

**Single environment variable controls everything:**

```bash
STRIPE_MODE=test  # or 'live'
```

**What switches automatically:**
- Secret key: `STRIPE_TEST_SECRET_KEY` ↔ `STRIPE_SECRET_KEY`
- Webhook secret: `STRIPE_TEST_WEBHOOK_SECRET` ↔ `STRIPE_WEBHOOK_SECRET`
- Price ID: `STRIPE_TEST_PRO_PRICE_ID` ↔ `STRIPE_PRO_PRICE_ID`

**Migration steps:**
1. Create live product/price in Stripe dashboard
2. Get live webhook secret from Stripe dashboard
3. Update `.env`:
   ```bash
   STRIPE_MODE=live
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRO_PRICE_ID=price_...
   ```
4. Update webhook endpoint in Stripe dashboard to production URL
5. Test with real card (Stripe test card: `4242 4242 4242 4242`)

**Code changes needed:** None ✅

### Recommended Improvements

1. **Add checkout button to account page:**
   ```typescript
   // If plan === 'free', show "Upgrade to Pro" button
   // Calls /api/create-checkout-session
   // Redirects to Stripe Checkout
   ```

2. **Fix mode defaults:**
   ```typescript
   // Make all routes default to 'test' for safety
   const mode = (process.env.STRIPE_MODE as StripeMode) || 'test'
   ```

3. **Pre-fill customer email:**
   ```typescript
   // In checkout session creation:
   customer_email: user?.email, // If authenticated
   ```

4. **Reuse existing customers:**
   ```typescript
   // Check if user has stripe_customer_id in profile
   // Use that instead of creating new customer
   ```

## Current Code Locations

- **Checkout API:** `app/api/create-checkout-session/route.ts`
- **Webhook:** `app/api/webhook/route.ts`
- **Billing Portal:** `app/api/portal/route.ts`
- **Account Page:** `app/account/page.tsx` (missing checkout button)
- **Dashboard:** `app/dashboard/page.tsx` (has upgrade links)



