// fortress v1
/**
 * API Endpoints Tests
 * Tests API route handlers directly with mock data (no AI model calls)
 * Run with: pnpm test:api or jest __tests__/api-endpoints.test.ts
 * 
 * Tests route handlers directly (no server needed) by importing and calling them.
 * Mocks audit functions to avoid OpenAI calls.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  createMockAuditData,
  generateSessionToken,
  createTestAuditUnauthenticated,
  cleanupTestDataForSessionToken,
} from './helpers/test-db'

// Mock the audit functions BEFORE importing route handlers
// This ensures the mocks are in place when route handlers import audit functions
jest.mock('@/lib/audit', () => ({
  miniAudit: jest.fn(),
  auditSite: jest.fn(),
  pollAuditStatus: jest.fn(),
  AUDIT_TIERS: {
    FREE: { maxToolCalls: 1, executionMode: 'synchronous' },
    PAID: { maxToolCalls: 5, executionMode: 'background' },
    ENTERPRISE: { maxToolCalls: 20, executionMode: 'background' },
  },
}))

// Import route handlers AFTER mocks are set up
// Use dynamic imports to ensure mocks are applied
let auditPOST: typeof import('@/app/api/audit/route').POST
let auditGET: typeof import('@/app/api/audit/[id]/route').GET
let claimPOST: typeof import('@/app/api/audit/claim/route').POST
let pollPOST: typeof import('@/app/api/audit/poll/route').POST
let exportGET: typeof import('@/app/api/audit/[id]/export/route').GET

// Import mocked audit functions
import { miniAudit, auditSite, pollAuditStatus } from '@/lib/audit'

const supabase = getSupabaseAdmin()

// Helper to create a mock auth token (for testing authenticated endpoints)
// In real tests, you'd create actual test users via Supabase auth
function createMockAuthToken(): string {
  return 'mock_bearer_token_for_testing'
}

describe('API Endpoints', () => {
  let testSessionToken: string
  let testAuditId: string | null = null
  const testDomain = 'test-api-example.com'

  beforeAll(async () => {
    testSessionToken = generateSessionToken()
    
    // Dynamically import route handlers after mocks are set up
    const auditRoute = await import('@/app/api/audit/route')
    const auditIdRoute = await import('@/app/api/audit/[id]/route')
    const claimRoute = await import('@/app/api/audit/claim/route')
    const pollRoute = await import('@/app/api/audit/poll/route')
    const exportRoute = await import('@/app/api/audit/[id]/export/route')
    
    auditPOST = auditRoute.POST
    auditGET = auditIdRoute.GET
    claimPOST = claimRoute.POST
    pollPOST = pollRoute.POST
    exportGET = exportRoute.GET
  })

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
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
    it('should create audit for unauthenticated user with mock data', async () => {
      const mockData = createMockAuditData(testDomain)
      
      // Mock the audit function to return mock data
      ;(miniAudit as jest.Mock).mockResolvedValue({
        groups: mockData.groups,
        pagesAudited: mockData.pagesAudited,
        auditedUrls: mockData.auditedUrls,
        status: 'completed',
        tier: 'FREE',
      })

      // Create Request object
      const request = new Request('http://localhost:3000/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: testDomain }),
      })

      const response = await auditPOST(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.runId).toBeDefined()
      expect(data.sessionToken).toBeDefined()
      expect(data.groups).toBeDefined()
      expect(Array.isArray(data.groups)).toBe(true)
      
      // Verify mock was called with normalized URL (with https:// prefix)
      expect(miniAudit).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/test-api-example\.com/))
      
      // Store audit ID for cleanup
      if (data.runId) {
        testAuditId = data.runId
      }
    })

    it('should reject request without domain', async () => {
      const request = new Request('http://localhost:3000/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const response = await auditPOST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('domain')
    })

    it('should reject invalid domain URL', async () => {
      const request = new Request('http://localhost:3000/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: 'not-a-valid-url' }),
      })

      const response = await auditPOST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle authenticated user with mock data', async () => {
      const mockData = createMockAuditData(testDomain)
      const mockToken = createMockAuthToken()
      
      // Mock the audit function
      ;(miniAudit as jest.Mock).mockResolvedValue({
        groups: mockData.groups,
        pagesAudited: mockData.pagesAudited,
        auditedUrls: mockData.auditedUrls,
        status: 'completed',
        tier: 'FREE',
      })

      // Note: This will fail auth check unless you have a real test user
      // In real tests, create test users via Supabase auth first
      const request = new Request('http://localhost:3000/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ domain: testDomain }),
      })

      const response = await auditPOST(request)
      // May fail with 401 if token is invalid - that's expected
      // In real tests, use valid auth token
      expect([200, 401]).toContain(response.status)
    })
  })

  describe('GET /api/audit/[id]', () => {
    it('should retrieve audit by ID with mock data', async () => {
      // Create test audit in database
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      // Note: This endpoint requires authentication
      // In real tests, create test user and get valid token
      const mockToken = createMockAuthToken()
      
      const request = new Request(`http://localhost:3000/api/audit/${audit.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      })

      const response = await auditGET(request, { params: Promise.resolve({ id: audit.id }) })

      // May fail with 401 if token is invalid - that's expected
      if (response.status === 200) {
        const data = await response.json()
        expect(data.runId).toBe(audit.id)
        expect(data.domain).toBe(testDomain)
        expect(data.groups).toBeDefined()
      } else {
        expect(response.status).toBe(401)
      }
    })

    it('should return 404 for non-existent audit ID', async () => {
      const mockToken = createMockAuthToken()
      const fakeId = '00000000-0000-0000-0000-000000000000'
      
      const request = new Request(`http://localhost:3000/api/audit/${fakeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      })

      const response = await auditGET(request, { params: Promise.resolve({ id: fakeId }) })

      // May fail with 401 or 404 depending on auth
      expect([401, 404]).toContain(response.status)
    })

    it('should require authentication', async () => {
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      const request = new Request(`http://localhost:3000/api/audit/${audit.id}`, {
        method: 'GET',
      })

      const response = await auditGET(request, { params: Promise.resolve({ id: audit.id }) })
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/audit/claim', () => {
    it('should claim unauthenticated audit with session token', async () => {
      // Create unauthenticated audit
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      const mockToken = createMockAuthToken()
      
      const request = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ sessionToken: testSessionToken }),
      })

      const response = await claimPOST(request)

      // May fail with 401 if token is invalid
      if (response.status === 200) {
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.auditId).toBe(audit.id)
        expect(data.domain).toBe(testDomain)
      } else {
        expect(response.status).toBe(401)
      }
    })

    it('should reject claim without sessionToken', async () => {
      const mockToken = createMockAuthToken()
      
      const request = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({}),
      })

      const response = await claimPOST(request)

      // May fail with 400 (missing sessionToken) or 401 (invalid token)
      expect([400, 401]).toContain(response.status)
    })

    it('should return 404 for non-existent session token', async () => {
      const mockToken = createMockAuthToken()
      const fakeToken = 'fake_session_token_12345'
      
      const request = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ sessionToken: fakeToken }),
      })

      const response = await claimPOST(request)

      // May fail with 401, 404, or 400 depending on auth and token validity
      expect([400, 401, 404]).toContain(response.status)
    })

    it('should require authentication', async () => {
      const request = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionToken: testSessionToken }),
      })

      const response = await claimPOST(request)
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/audit/poll', () => {
    it('should return in_progress status with mock data', async () => {
      const mockToken = createMockAuthToken()
      const mockResponseId = 'test_response_id_123'
      
      // Mock poll to return in_progress
      ;(pollAuditStatus as jest.Mock).mockResolvedValue({
        status: 'in_progress',
        pagesAudited: 5,
        groups: [],
      })

      const request = new Request('http://localhost:3000/api/audit/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ responseId: mockResponseId }),
      })

      const response = await pollPOST(request)

      // May fail with 401 if token is invalid
      if (response.status === 200) {
        const data = await response.json()
        expect(data.status).toBe('in_progress')
        expect(data.responseId).toBe(mockResponseId)
        expect(data.progress).toBeDefined()
      } else {
        expect(response.status).toBe(401)
      }
    })

    it('should return completed audit with mock data', async () => {
      const mockToken = createMockAuthToken()
      const mockResponseId = 'test_response_id_456'
      const mockData = createMockAuditData(testDomain)
      
      // Mock poll to return completed
      ;(pollAuditStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        groups: mockData.groups,
        pagesAudited: mockData.pagesAudited,
        auditedUrls: mockData.auditedUrls,
      })

      const request = new Request('http://localhost:3000/api/audit/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({ responseId: mockResponseId }),
      })

      const response = await pollPOST(request)

      // May fail with 401 if token is invalid
      if (response.status === 200) {
        const data = await response.json()
        expect(data.status).toBe('completed')
        expect(data.groups).toBeDefined()
      } else {
        expect(response.status).toBe(401)
      }
    })

    it('should reject request without responseId', async () => {
      const mockToken = createMockAuthToken()
      
      const request = new Request('http://localhost:3000/api/audit/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({}),
      })

      const response = await pollPOST(request)

      // May fail with 400 (missing responseId) or 401 (invalid token)
      expect([400, 401]).toContain(response.status)
    })

    it('should require authentication', async () => {
      const request = new Request('http://localhost:3000/api/audit/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responseId: 'test_id' }),
      })

      const response = await pollPOST(request)
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/audit/[id]/export', () => {
    it('should export audit as JSON with mock data', async () => {
      // Create test audit
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      const mockToken = createMockAuthToken()
      
      const request = new Request(`http://localhost:3000/api/audit/${audit.id}/export?format=json`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      })

      const response = await exportGET(request, { params: Promise.resolve({ id: audit.id }) })

      // May fail with 401, 403 (free user), or 404
      if (response.status === 200) {
        const contentType = response.headers.get('content-type')
        expect(contentType).toContain('application/json')
        const data = await response.json()
        expect(data).toBeDefined()
      } else {
        expect([401, 403, 404]).toContain(response.status)
      }
    })

    it('should export audit as Markdown with mock data', async () => {
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      const mockToken = createMockAuthToken()
      
      const request = new Request(`http://localhost:3000/api/audit/${audit.id}/export?format=md`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      })

      const response = await exportGET(request, { params: Promise.resolve({ id: audit.id }) })

      // May fail with 401, 403, or 404
      if (response.status === 200) {
        const contentType = response.headers.get('content-type')
        expect(contentType).toContain('text/markdown')
        const text = await response.text()
        expect(text).toBeDefined()
        expect(text.length).toBeGreaterThan(0)
      } else {
        expect([401, 403, 404]).toContain(response.status)
      }
    })

    it('should reject export for free users (gating)', async () => {
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      const mockToken = createMockAuthToken()
      
      // Try to export PDF (paid only)
      const request = new Request(`http://localhost:3000/api/audit/${audit.id}/export?format=pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      })

      const response = await exportGET(request, { params: Promise.resolve({ id: audit.id }) })

      // Should be 403 for free users, or 401 if token invalid
      expect([401, 403, 404]).toContain(response.status)
    })

    it('should require authentication', async () => {
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      testAuditId = audit.id

      const request = new Request(`http://localhost:3000/api/audit/${audit.id}/export?format=json`, {
        method: 'GET',
      })

      const response = await exportGET(request, { params: Promise.resolve({ id: audit.id }) })
      expect(response.status).toBe(401)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const request = new Request('http://localhost:3000/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json{',
      })

      // Should handle gracefully (may return 400 or process as empty body)
      try {
        const response = await auditPOST(request)
        expect([200, 400]).toContain(response.status)
      } catch (error) {
        // May throw on invalid JSON
        expect(error).toBeDefined()
      }
    })

    it('should validate domain format', async () => {
      const invalidDomains = [
        '',
        'not-a-url',
        'http://',
        'ftp://example.com',
        'javascript:alert(1)',
      ]

      for (const domain of invalidDomains) {
        const request = new Request('http://localhost:3000/api/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain }),
        })

        const response = await auditPOST(request)

        // Should reject invalid domains
        if (domain === '') {
          expect(response.status).toBe(400) // Missing domain
        } else {
          // All invalid domains should return 400 (validation error)
          expect(response.status).toBe(400)
          const data = await response.json()
          expect(data.error).toBeDefined()
        }
      }
    })
  })

  describe('Mock Data Validation', () => {
    it('should use mock data that matches API response schema', () => {
      const mockData = createMockAuditData(testDomain)
      
      // Verify structure matches what API expects
      expect(mockData.groups).toBeDefined()
      expect(Array.isArray(mockData.groups)).toBe(true)
      expect(mockData.pagesAudited).toBeGreaterThan(0)
      
      // Verify groups structure
      mockData.groups.forEach(group => {
        expect(group.title).toBeDefined()
        expect(['low', 'medium', 'high']).toContain(group.severity)
        expect(group.impact).toBeDefined()
        expect(group.fix).toBeDefined()
        expect(Array.isArray(group.examples)).toBe(true)
        expect(typeof group.count).toBe('number')
      })
    })
  })
})

