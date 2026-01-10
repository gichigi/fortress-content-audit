--
**Testing notes**

## pricing
will be rewritten

## other

1) Configure Stripe webhook endpoint (required)
Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
Endpoint URL: https://yourdomain.com/api/webhook
Events to listen for:
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
Save and copy the signing secret (starts with whsec_...)
2) Set production environment variables
STRIPE_MODE=test (to use test keys)
STRIPE_TEST_SECRET_KEY (already set)
STRIPE_TEST_WEBHOOK_SECRET (from step 1 — different from local)
STRIPE_TEST_PUBLISHABLE_KEY (already set)
STRIPE_TEST_PRO_PRICE_ID (already set)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
3) Verify the webhook endpoint
Send a test webhook from the Stripe Dashboard to confirm it’s reachable
Important: The webhook signing secret from Stripe will be different from your local stripe listen secret.
Creating a deployment checklist: