// fortress v1
/**
 * Auth & User Flow Tests
 * Tests authentication flows, user creation, and audit claiming
 * Run with: pnpm test:auth or jest __tests__/auth-user-flow.test.ts
 * 
 * Tests:
 * - Signup flow (test user creation, profile auto-creation)
 * - Auto-claim on dashboard load (claim endpoint with real auth tokens)
 * - Unauthenticated → authenticated flow (full flow test)
 * - Authenticated free tier (audit storage with user_id)
 * - User plan verification and gating
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  createMockAuditData,
  generateSessionToken,
  createTestAuditUnauthenticated,
  cleanupTestDataForSessionToken,
  cleanupTestDataForUser,
} from './helpers/test-db'

// Mock the audit functions BEFORE importing route handlers
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
let claimPOST: typeof import('@/app/api/audit/claim/route').POST
let auditPOST: typeof import('@/app/api/audit/route').POST
let auditGET: typeof import('@/app/api/audit/[id]/route').GET
let exportGET: typeof import('@/app/api/audit/[id]/export/route').GET

// Import mocked audit functions
import { miniAudit } from '@/lib/audit'

const supabase = getSupabaseAdmin()
const testDomain = 'test-auth-example.com'

// Helper to create a test user and get their access token
async function createTestUser(email: string, password: string = 'test-password-123') {
  // Create user via admin API
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for testing
  })

  if (createError || !userData?.user) {
    throw new Error(`Failed to create test user: ${createError?.message || 'Unknown error'}`)
  }

  // Get access token by signing in
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !sessionData?.session?.access_token) {
    // Clean up user if sign-in fails
    await supabase.auth.admin.deleteUser(userData.user.id)
    throw new Error(`Failed to sign in test user: ${signInError?.message || 'Unknown error'}`)
  }

  return {
    userId: userData.user.id,
    email: userData.user.email!,
    accessToken: sessionData.session.access_token,
    session: sessionData.session,
  }
}

// Helper to delete test user
async function deleteTestUser(userId: string) {
  await supabase.auth.admin.deleteUser(userId)
}

describe('Auth & User Flow', () => {
  let testUser1: { userId: string; email: string; accessToken: string } | null = null
  let testUser2: { userId: string; email: string; accessToken: string } | null = null
  let testSessionToken: string

  beforeAll(async () => {
    testSessionToken = generateSessionToken()
    
    // Dynamically import route handlers after mocks are set up
    const claimRoute = await import('@/app/api/audit/claim/route')
    const auditRoute = await import('@/app/api/audit/route')
    const auditIdRoute = await import('@/app/api/audit/[id]/route')
    const exportRoute = await import('@/app/api/audit/[id]/export/route')
    
    claimPOST = claimRoute.POST
    auditPOST = auditRoute.POST
    auditGET = auditIdRoute.GET
    exportGET = exportRoute.GET
  })

  afterEach(async () => {
    // Clean up test users
    if (testUser1) {
      await cleanupTestDataForUser(testUser1.userId)
      await deleteTestUser(testUser1.userId)
      testUser1 = null
    }
    if (testUser2) {
      await cleanupTestDataForUser(testUser2.userId)
      await deleteTestUser(testUser2.userId)
      testUser2 = null
    }
    // Clean up session token audits
    await cleanupTestDataForSessionToken(testSessionToken)
  })

  describe('Signup Flow', () => {
    it('should create test user and auto-create profile', async () => {
      const testEmail = `test-signup-${Date.now()}@example.com`
      
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Verify user was created
      expect(user.userId).toBeDefined()
      expect(user.email).toBe(testEmail)
      expect(user.accessToken).toBeDefined()

      // Verify profile was auto-created (via trigger)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.userId)
        .maybeSingle()

      expect(profileError).toBeNull()
      expect(profile).toBeTruthy()
      expect(profile?.user_id).toBe(user.userId)
      expect(profile?.plan).toBe('free') // Default plan
    })

    it('should allow user to sign in and get access token', async () => {
      const testEmail = `test-signin-${Date.now()}@example.com`
      
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Verify access token is valid by using it to get user info
      const { data: userData, error: userError } = await supabase.auth.getUser(user.accessToken)
      
      expect(userError).toBeNull()
      expect(userData?.user?.id).toBe(user.userId)
      expect(userData?.user?.email).toBe(testEmail)
    })
  })

  describe('Auto-Claim on Dashboard Load', () => {
    it('should claim unauthenticated audit when user provides session token', async () => {
      // Create unauthenticated audit
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      expect(audit.user_id).toBeNull()
      expect(audit.session_token).toBe(testSessionToken)

      // Create test user
      const testEmail = `test-claim-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Call claim endpoint with user's access token
      const request = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({ sessionToken: testSessionToken }),
      })

      const response = await claimPOST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.auditId).toBe(audit.id)
      expect(data.domain).toBe(testDomain)

      // Verify audit was claimed (user_id set, session_token cleared)
      // Use admin client to bypass RLS
      const { data: claimedAudit } = await supabase
        .from('brand_audit_runs')
        .select('*')
        .eq('id', audit.id)
        .maybeSingle()

      expect(claimedAudit?.user_id).toBe(user.userId)
      expect(claimedAudit?.session_token).toBeNull()
      expect(claimedAudit?.is_preview).toBe(false) // No longer preview once claimed
    })

    it('should reject claim with invalid session token', async () => {
      const testEmail = `test-claim-invalid-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      const request = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({ sessionToken: 'invalid-token-12345' }),
      })

      const response = await claimPOST(request)
      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toContain('not found')
    })

    it('should reject claim without authentication', async () => {
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

  describe('Unauthenticated → Authenticated Flow', () => {
    it('should complete full flow: unauthenticated audit → signup → claim', async () => {
      // Step 1: Create unauthenticated audit (simulating homepage audit)
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      expect(audit.user_id).toBeNull()
      expect(audit.session_token).toBe(testSessionToken)

      // Step 2: User signs up (simulated by creating test user)
      const testEmail = `test-fullflow-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Step 3: User claims audit (simulating dashboard auto-claim)
      const request = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({ sessionToken: testSessionToken }),
      })

      const response = await claimPOST(request)
      expect(response.status).toBe(200)

      // Step 4: Verify user can now access their audit
      const getRequest = new Request(`http://localhost:3000/api/audit/${audit.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
        },
      })

      const getResponse = await auditGET(getRequest, { params: Promise.resolve({ id: audit.id }) })
      expect(getResponse.status).toBe(200)

      const auditData = await getResponse.json()
      expect(auditData.runId).toBe(audit.id)
      expect(auditData.domain).toBe(testDomain)
    })
  })

  describe('Authenticated Free Tier', () => {
    it('should create audit with user_id when authenticated', async () => {
      const testEmail = `test-authenticated-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      const mockData = createMockAuditData(testDomain)

      // Mock the audit function
      ;(miniAudit as jest.Mock).mockResolvedValue({
        groups: mockData.groups,
        pagesScanned: mockData.pagesScanned,
        auditedUrls: mockData.auditedUrls,
        status: 'completed',
        tier: 'FREE',
      })

      // Create audit request with auth token
      const request = new Request('http://localhost:3000/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({ domain: testDomain }),
      })

      const response = await auditPOST(request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.runId).toBeDefined()
      // No session token for authenticated users (may be null or undefined)
      expect(data.sessionToken === null || data.sessionToken === undefined).toBe(true)

      // Verify audit was stored with user_id
      const { data: storedAudit } = await supabase
        .from('brand_audit_runs')
        .select('*')
        .eq('id', data.runId)
        .maybeSingle()

      expect(storedAudit?.user_id).toBe(user.userId)
      expect(storedAudit?.session_token).toBeNull()
      expect(storedAudit?.domain).toBe(`https://${testDomain}`) // Normalized domain
    })

    it('should allow authenticated user to retrieve their audits', async () => {
      const testEmail = `test-retrieve-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Create audit for user using admin client (bypasses RLS)
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      
      // Manually set user_id (simulating authenticated creation) using admin client
      await supabase
        .from('brand_audit_runs')
        .update({ user_id: user.userId, session_token: null })
        .eq('id', audit.id)

      // Retrieve audit
      const request = new Request(`http://localhost:3000/api/audit/${audit.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
        },
      })

      const response = await auditGET(request, { params: Promise.resolve({ id: audit.id }) })
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.runId).toBe(audit.id)
      expect(data.domain).toBe(testDomain)
    })
  })

  describe('User Plan Verification and Gating', () => {
    it('should default new users to free plan', async () => {
      const testEmail = `test-plan-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Check profile plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.userId)
        .maybeSingle()

      expect(profile?.plan).toBe('free')
    })

    it('should allow updating user plan', async () => {
      const testEmail = `test-plan-update-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Update plan to 'paid'
      await supabase
        .from('profiles')
        .update({ plan: 'paid' })
        .eq('user_id', user.userId)

      // Verify plan was updated
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.userId)
        .maybeSingle()

      expect(profile?.plan).toBe('paid')
    })

    it('should enforce plan-based gating in API endpoints', async () => {
      const testEmail = `test-gating-${Date.now()}@example.com`
      const user = await createTestUser(testEmail)
      testUser1 = user

      // Create audit
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)
      await supabase
        .from('brand_audit_runs')
        .update({ user_id: user.userId, session_token: null })
        .eq('id', audit.id)

      // Test export endpoint (gated to paid users)
      const request = new Request(`http://localhost:3000/api/audit/${audit.id}/export?format=pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
        },
      })

      const response = await exportGET(request, { params: Promise.resolve({ id: audit.id }) })
      
      // Should be 403 for free users
      expect(response.status).toBe(403)
      
      const data = await response.json()
      expect(data.error).toBeDefined()
      expect(data.upgradeRequired).toBe(true)
    })
  })

  describe('Concurrent Claims', () => {
    it('should handle multiple users trying to claim same audit', async () => {
      // Create unauthenticated audit
      const audit = await createTestAuditUnauthenticated(testSessionToken, testDomain)

      // Create two users
      const user1 = await createTestUser(`test-concurrent1-${Date.now()}@example.com`)
      const user2 = await createTestUser(`test-concurrent2-${Date.now()}@example.com`)
      testUser1 = user1
      testUser2 = user2

      // User 1 claims audit
      const request1 = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1.accessToken}`,
        },
        body: JSON.stringify({ sessionToken: testSessionToken }),
      })

      const response1 = await claimPOST(request1)
      if (response1.status !== 200) {
        const errorData = await response1.json()
        console.error('Claim failed:', JSON.stringify(errorData, null, 2))
      }
      expect(response1.status).toBe(200)

      // User 2 tries to claim same audit (should fail)
      const request2 = new Request('http://localhost:3000/api/audit/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user2.accessToken}`,
        },
        body: JSON.stringify({ sessionToken: testSessionToken }),
      })

      const response2 = await claimPOST(request2)
      expect(response2.status).toBe(404) // Audit already claimed

      // Verify audit belongs to user 1
      const { data: claimedAudit } = await supabase
        .from('brand_audit_runs')
        .select('*')
        .eq('id', audit.id)
        .maybeSingle()

      expect(claimedAudit?.user_id).toBe(user1.userId)
      expect(claimedAudit?.user_id).not.toBe(user2.userId)
    })
  })
})

