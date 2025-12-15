// fortress v1 - Audit Rate Limiting Utilities
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface AuditLimits {
  maxDomains: number
  maxAuditsPerDay: number
}

export interface AuditUsage {
  today: number
  limit: number
  domains: number
  domainLimit: number
  resetAt: string // ISO timestamp of next reset (midnight UTC)
}

/**
 * Get audit limits for a plan tier
 */
export function getAuditLimits(plan: string): AuditLimits {
  switch (plan) {
    case 'pro':
      return {
        maxDomains: 5,
        maxAuditsPerDay: 1, // per domain
      }
    case 'enterprise':
      return {
        maxDomains: Infinity,
        maxAuditsPerDay: Infinity,
      }
    case 'free':
    default:
      return {
        maxDomains: 1,
        maxAuditsPerDay: 1, // per domain
      }
  }
}

/**
 * Get today's date in UTC (YYYY-MM-DD format)
 */
function getTodayUTC(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get next reset time (midnight UTC tomorrow)
 */
function getNextResetTime(): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

/**
 * Check if user has exceeded daily audit limit for a domain
 */
export async function checkDailyLimit(
  userId: string,
  domain: string,
  plan: string
): Promise<{ allowed: boolean; used: number; limit: number; resetAt: string }> {
  const limits = getAuditLimits(plan)
  
  // Enterprise users have unlimited audits
  if (limits.maxAuditsPerDay === Infinity) {
    return {
      allowed: true,
      used: 0,
      limit: Infinity,
      resetAt: getNextResetTime(),
    }
  }

  const today = getTodayUTC()

  // Get today's usage for this domain
  const { data: usage, error } = await supabaseAdmin
    .from('audit_usage')
    .select('audit_count')
    .eq('user_id', userId)
    .eq('domain', domain)
    .eq('date', today)
    .maybeSingle()

  if (error) {
    console.error('[RateLimit] Error checking daily limit:', error)
    // On error, allow the request (fail open)
    return {
      allowed: true,
      used: 0,
      limit: limits.maxAuditsPerDay,
      resetAt: getNextResetTime(),
    }
  }

  const used = usage?.audit_count || 0
  const allowed = used < limits.maxAuditsPerDay

  return {
    allowed,
    used,
    limit: limits.maxAuditsPerDay,
    resetAt: getNextResetTime(),
  }
}

/**
 * Check if user has exceeded domain limit
 */
export async function checkDomainLimit(
  userId: string,
  plan: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const limits = getAuditLimits(plan)
  
  // Enterprise users have unlimited domains
  if (limits.maxDomains === Infinity) {
    return {
      allowed: true,
      count: 0,
      limit: Infinity,
    }
  }

  // Count distinct domains from audit runs (all time)
  const { data: audits, error } = await supabaseAdmin
    .from('brand_audit_runs')
    .select('domain')
    .eq('user_id', userId)
    .not('domain', 'is', null)

  if (error) {
    console.error('[RateLimit] Error checking domain limit:', error)
    // On error, allow the request (fail open)
    return {
      allowed: true,
      count: 0,
      limit: limits.maxDomains,
    }
  }

  // Get unique domains
  const uniqueDomains = new Set(
    audits?.map((a) => a.domain).filter((d): d is string => d !== null) || []
  )
  const count = uniqueDomains.size
  const allowed = count < limits.maxDomains

  return {
    allowed,
    count,
    limit: limits.maxDomains,
  }
}

/**
 * Check if domain is new for this user
 */
export async function isNewDomain(
  userId: string,
  domain: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('brand_audit_runs')
    .select('id')
    .eq('user_id', userId)
    .eq('domain', domain)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[RateLimit] Error checking if domain is new:', error)
    // On error, assume it's new (more restrictive)
    return true
  }

  return !data
}

/**
 * Increment audit usage count for today
 * Uses atomic increment to prevent race conditions
 */
export async function incrementAuditUsage(
  userId: string,
  domain: string
): Promise<void> {
  const today = getTodayUTC()

  // Use upsert with increment to handle atomic updates
  const { error } = await supabaseAdmin
    .from('audit_usage')
    .upsert(
      {
        user_id: userId,
        domain,
        date: today,
        audit_count: 1,
      },
      {
        onConflict: 'user_id,domain,date',
        ignoreDuplicates: false,
      }
    )

  if (error) {
    // If upsert fails, try to increment existing record
    const { data: existing } = await supabaseAdmin
      .from('audit_usage')
      .select('audit_count')
      .eq('user_id', userId)
      .eq('domain', domain)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('audit_usage')
        .update({ audit_count: (existing.audit_count || 0) + 1 })
        .eq('user_id', userId)
        .eq('domain', domain)
        .eq('date', today)

      if (updateError) {
        console.error('[RateLimit] Error incrementing audit usage:', updateError)
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabaseAdmin
        .from('audit_usage')
        .insert({
          user_id: userId,
          domain,
          date: today,
          audit_count: 1,
        })

      if (insertError) {
        console.error('[RateLimit] Error inserting audit usage:', insertError)
      }
    }
  }
}

/**
 * Get current usage info for a user
 */
export async function getAuditUsage(
  userId: string,
  domain: string | null,
  plan: string
): Promise<AuditUsage> {
  const limits = getAuditLimits(plan)
  const today = getTodayUTC()

  // Get today's usage for domain (if provided)
  let todayUsage = 0
  if (domain) {
    const { data: usage } = await supabaseAdmin
      .from('audit_usage')
      .select('audit_count')
      .eq('user_id', userId)
      .eq('domain', domain)
      .eq('date', today)
      .maybeSingle()

    todayUsage = usage?.audit_count || 0
  }

  // Count distinct domains
  const { data: audits } = await supabaseAdmin
    .from('brand_audit_runs')
    .select('domain')
    .eq('user_id', userId)
    .not('domain', 'is', null)

  const uniqueDomains = new Set(
    audits?.map((a) => a.domain).filter((d): d is string => d !== null) || []
  )
  const domainCount = uniqueDomains.size

  return {
    today: todayUsage,
    limit: limits.maxAuditsPerDay === Infinity ? 0 : limits.maxAuditsPerDay,
    domains: domainCount,
    domainLimit: limits.maxDomains === Infinity ? 0 : limits.maxDomains,
    resetAt: getNextResetTime(),
  }
}

