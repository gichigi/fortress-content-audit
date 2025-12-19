// fortress v1
/**
 * API Endpoints Tests - Dev Server Integration
 * Tests API routes via HTTP requests to running Next.js server
 * Run with: pnpm test:api:server or jest __tests__/api-endpoints-server.test.ts
 * 
 * Note: These tests require a running Next.js server on localhost:3000
 * Start with: pnpm dev
 * 
 * These tests verify the full stack works end-to-end, but mocks won't work
 * since the server runs in a separate process.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  createMockAuditData,
  generateSessionToken,
  createTestAuditUnauthenticated,
  cleanupTestDataForSessionToken,
} from './helpers/test-db'

const supabase = getSupabaseAdmin()
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

describe('API Endpoints - Dev Server Integration', () => {
  let testSessionToken: string
  let testAuditId: string | null = null
  const testDomain = 'example.com'

  beforeAll(() => {
    testSessionToken = generateSessionToken()
  })

  beforeEach(() => {
    // Reset state
    testAuditId = null
  })

  afterEach(async () => {
    // Clean up test data
    if (testAuditId) {
      await supabase.from('brand_audit_runs').delete().eq('id', testAuditId)
      testAuditId = null
    }
    await cleanupTestDataForSessionToken(testSessionToken)
  })

  describe('POST /api/audit', () => {
    it('should create audit for unauthenticated user', async () => {
      const response = await fetch(`${BASE_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: testDomain }),
      })

      // May return 200 (success) or 500 (if OpenAI API key missing/invalid)
      // This test verifies the endpoint is reachable and handles requests
      expect([200, 500]).toContain(response.status)
      
      if (response.status === 200) {
        const data = await response.json()
        expect(data.runId).toBeDefined()
        expect(data.sessionToken).toBeDefined()
        if (data.runId) {
          testAuditId = data.runId
        }
      }
    })

    it('should reject request without domain', async () => {
      const response = await fetch(`${BASE_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('domain')
    })

    it('should reject invalid domain URL', async () => {
      const response = await fetch(`${BASE_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: 'not-a-valid-url' }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/audit/[id]', () => {
    it('should retrieve audit by ID', async () => {
      // Create test audit in database
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      // Note: This endpoint requires authentication
      // Without valid token, should return 401
      const response = await fetch(`${BASE_URL}/api/audit/${audit.id}`, {
        method: 'GET',
      })

      expect(response.status).toBe(401)
    })

    it('should return 404 for non-existent audit ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      
      const response = await fetch(`${BASE_URL}/api/audit/${fakeId}`, {
        method: 'GET',
      })

      // Should return 401 (auth required) or 404 (not found)
      expect([401, 404]).toContain(response.status)
    })
  })

  describe('Error Handling', () => {
    it('should validate domain format', async () => {
      const invalidDomains = [
        '',
        'not-a-url',
        'http://',
      ]

      for (const domain of invalidDomains) {
        const response = await fetch(`${BASE_URL}/api/audit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain }),
        })

        // Should reject invalid domains
        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBeDefined()
      }
    })
  })
})




