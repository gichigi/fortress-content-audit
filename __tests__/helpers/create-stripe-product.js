/**
 * Create Stripe test product and price
 * Run with: node __tests__/helpers/create-stripe-product.js
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const STRIPE_TEST_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY;

if (!STRIPE_TEST_SECRET_KEY) {
  console.error('❌ STRIPE_TEST_SECRET_KEY is required in .env.local');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

async function createProduct() {
  try {
    console.log('🔧 Creating Stripe test product and price...\n');

    // Create product
    const product = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Pro subscription plan for content audit',
      metadata: {
        test: 'true',
        plan: 'pro',
      },
    });

    console.log(`✅ Created product: ${product.id} (${product.name})`);

    // Create price (monthly subscription, $29/month = 2900 cents)
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 2900, // $29.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        test: 'true',
        plan: 'pro',
      },
    });

    console.log(`✅ Created price: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/${price.recurring.interval})\n`);

    console.log('📋 Add this to your .env.local:');
    console.log(`STRIPE_TEST_PRO_PRICE_ID=${price.id}\n`);

    return { productId: product.id, priceId: price.id };
  } catch (error) {
    console.error('❌ Failed to create Stripe test product:', error.message);
    throw error;
  }
}

createProduct()
  .then(() => {
    console.log('✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });

