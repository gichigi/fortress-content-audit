import { checkDailyLimit, getAuditLimits, checkDomainLimit } from '../audit-rate-limit'
import { supabaseAdmin } from '../supabase-admin'

// Mock supabase-admin
jest.mock('../supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}))

describe('audit-rate-limit', () => {
  const mockUserId = 'test-user-123'
  const mockDomain = 'example.com'
  const mockEmail = 'test@example.com'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAuditLimits', () => {
    it('should return correct limits for free plan', () => {
      const limits = getAuditLimits('free')
      expect(limits.maxDomains).toBe(1)
      expect(limits.maxAuditsPerDay).toBe(1)
    })

    it('should return correct limits for pro plan', () => {
      const limits = getAuditLimits('pro')
      expect(limits.maxDomains).toBe(5)
      expect(limits.maxAuditsPerDay).toBe(1)
    })

    it('should return correct limits for enterprise plan', () => {
      const limits = getAuditLimits('enterprise')
      expect(limits.maxDomains).toBe(Infinity)
      expect(limits.maxAuditsPerDay).toBe(1)
    })
  })

  describe('checkDailyLimit', () => {
    it('should allow audit when no usage exists', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }

      ;(supabaseAdmin.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await checkDailyLimit(mockUserId, mockDomain, 'free', mockEmail)

      expect(result.allowed).toBe(true)
      expect(result.used).toBe(0)
      expect(result.limit).toBe(1)
    })

    it('should block audit when daily limit reached', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { audit_count: 1 },
          error: null,
        }),
      }

      ;(supabaseAdmin.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await checkDailyLimit(mockUserId, mockDomain, 'free', mockEmail)

      expect(result.allowed).toBe(false)
      expect(result.used).toBe(1)
      expect(result.limit).toBe(1)
    })
  })

  describe('checkDomainLimit', () => {
    it('should allow new domain when under limit', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({
          data: [], // No domains yet
          error: null,
        }),
      }

      ;(supabaseAdmin.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await checkDomainLimit(mockUserId, 'free')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(0)
      expect(result.limit).toBe(1)
    })

    it('should block new domain when limit reached', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({
          data: [{ domain: 'example.com' }],
          error: null,
        }),
      }

      ;(supabaseAdmin.from as jest.Mock).mockReturnValue(mockQuery)

      const result = await checkDomainLimit(mockUserId, 'free')

      expect(result.allowed).toBe(false)
      expect(result.count).toBe(1)
      expect(result.limit).toBe(1)
    })

    it('should allow unlimited domains for enterprise plan', async () => {
      const result = await checkDomainLimit(mockUserId, 'enterprise')

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(Infinity)
      expect(supabaseAdmin.from).not.toHaveBeenCalled()
    })
  })
})

