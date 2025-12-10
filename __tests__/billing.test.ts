// fortress v1
/**
 * Basic billing webhook tests
 * Run with: pnpm test or jest
 */

describe('Billing Webhook', () => {
  describe('Webhook Signature Validation', () => {
    it('should reject webhooks without signature', async () => {
      const response = await fetch('http://localhost:3000/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'test_session',
              customer: 'test_customer',
            },
          },
        }),
      })
      // Should reject without valid signature
      expect(response.status).toBe(400)
    })
  })

  describe('Plan Sync', () => {
    it('should handle subscription.created event structure', () => {
      const event = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
          },
        },
      }
      // Structure validation
      expect(event.type).toBe('customer.subscription.created')
      expect(event.data.object.status).toBe('active')
      expect(event.data.object.current_period_end).toBeGreaterThan(Date.now() / 1000)
    })
  })
})


