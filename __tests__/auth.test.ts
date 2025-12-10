// fortress v1
/**
 * Basic auth flow tests
 * Run with: pnpm test or jest
 */

describe('Auth Flow', () => {
  describe('Session Validation', () => {
    it('should reject requests without Bearer token', async () => {
      const response = await fetch('http://localhost:3000/api/guidelines', {
        method: 'GET',
      })
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should reject invalid Bearer tokens', async () => {
      const response = await fetch('http://localhost:3000/api/guidelines', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token-12345',
        },
      })
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Invalid token')
    })
  })

  describe('Protected Routes', () => {
    it('should require authentication for guideline creation', async () => {
      const response = await fetch('http://localhost:3000/api/guidelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Guideline',
          content_md: '# Test',
        }),
      })
      expect(response.status).toBe(401)
    })
  })
})


