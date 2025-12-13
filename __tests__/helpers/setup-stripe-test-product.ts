/**
 * Setup script to create Stripe test product and price
 * Run with: pnpm tsx __tests__/helpers/setup-stripe-test-product.ts
 * 
 * This creates a test product and price in Stripe test mode
 * that matches your Pro plan structure.
 */

import Stripe from 'stripe'

const STRIPE_TEST_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY

if (!STRIPE_TEST_SECRET_KEY) {
  throw new Error('STRIPE_TEST_SECRET_KEY is required')
}

const stripe = new Stripe(STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

async function setupStripeTestProduct() {
  try {
    console.log('🔧 Setting up Stripe test product and price...')

    // Create product
    const product = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Pro subscription plan for content audit',
      metadata: {
        test: 'true',
        plan: 'pro',
      },
    })

    console.log(`✅ Created product: ${product.id} (${product.name})`)

    // Create price (monthly subscription, $29/month = 2900 cents)
    // Adjust the amount as needed for your actual Pro plan price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 2900, // $29.00 in cents - adjust as needed
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        test: 'true',
        plan: 'pro',
      },
    })

    console.log(`✅ Created price: ${price.id} ($${(price.unit_amount! / 100).toFixed(2)}/${price.recurring?.interval})`)

    console.log('\n📋 Add these to your .env.local:')
    console.log(`STRIPE_TEST_PRO_PRICE_ID=${price.id}`)
    console.log(`\n💡 Product ID (for reference): ${product.id}`)

    return {
      productId: product.id,
      priceId: price.id,
    }
  } catch (error) {
    console.error('❌ Failed to create Stripe test product:', error)
    throw error
  }
}

// Run if executed directly
if (require.main === module) {
  setupStripeTestProduct()
    .then(() => {
      console.log('\n✅ Setup complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error)
      process.exit(1)
    })
}

export { setupStripeTestProduct }

