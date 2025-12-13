# Email Captures Table

## Overview

The `email_captures` table tracks email addresses captured during the checkout flow and manages email sending state for payment success and abandoned cart flows.

## Table Schema

```sql
CREATE TABLE public.email_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  payment_completed BOOLEAN DEFAULT false,
  abandoned_email_sent BOOLEAN DEFAULT false,
  captured_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Relationships

**No foreign keys** - This table is intentionally standalone:
- `session_token` is a unique identifier (not a foreign key)
- Used to track email captures independently of user accounts
- Works for both authenticated and unauthenticated users

## Usage Flow

### 1. Email Capture (POST /api/capture-email)
- User enters email during checkout
- Stored with `session_token` (unique identifier)
- `payment_completed: false` initially

### 2. Payment Success (Webhook: checkout.session.completed)
- Webhook receives `email_capture_token` in metadata
- Calls `/api/capture-email` PUT to mark `payment_completed: true`
- Prevents abandoned cart emails from being sent
- Webhook also uses `email_captures` to track thank you emails sent

### 3. Abandoned Cart (Webhook: checkout.session.expired)
- Webhook checks `email_captures` to see if email already sent
- Uses `session_token` format: `abandoned_{email}`
- Sets `abandoned_email_sent: true` to prevent duplicates

### 4. Thank You Email (Webhook: checkout.session.completed)
- Webhook tracks thank you emails sent
- Uses `session_token` format: `thankyou_{session.id}`
- Sets `payment_completed: true` when thank you email sent

## Key Fields

- **session_token**: Unique identifier (can be checkout session token, email-based key, or Stripe session ID)
- **email**: Customer email address
- **payment_completed**: Prevents abandoned cart emails after successful payment
- **abandoned_email_sent**: Prevents duplicate abandoned cart emails

## Integration Points

1. **Checkout Session Creation** (`/api/create-checkout-session`)
   - Accepts optional `emailCaptureToken` in request body
   - Stores in Stripe checkout session metadata

2. **Webhook Handler** (`/api/webhook`)
   - Reads `email_capture_token` from session metadata
   - Marks captures as payment completed
   - Tracks email sending state

3. **Email Capture API** (`/api/capture-email`)
   - POST: Store email capture
   - PUT: Mark as payment completed
   - GET: Retrieve captures (admin/debugging)

## Production Status

✅ **Table exists in production** (created via migration)  
✅ **All code paths tested** (17/17 tests passing)  
✅ **No production code changes needed** - table was missing but migration applied

