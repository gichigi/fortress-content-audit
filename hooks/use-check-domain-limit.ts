"use client"

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface UsageInfo {
  today: number
  limit: number
  domains: number
  domainLimit: number
  resetAt?: string
}

interface CheckLimitResult {
  isAtLimit: boolean
  plan: 'free' | 'pro' | 'enterprise'
  currentDomains: number
  domainLimit: number
}

interface DomainLimitResult {
  isAtLimit: boolean
  loading: boolean
  plan: 'free' | 'pro' | 'enterprise'
  currentDomains: number
  domainLimit: number
  checkLimit: () => Promise<CheckLimitResult>
}

export function useCheckDomainLimit(): DomainLimitResult {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<'free' | 'pro' | 'enterprise'>('free')
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)

  const checkLimit = useCallback(async (): Promise<CheckLimitResult> => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setLoading(false)
        // Return default for non-authenticated users
        return {
          isAtLimit: false,
          plan: 'free',
          currentDomains: 0,
          domainLimit: 1
        }
      }

      // Get user plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', session.user.id)
        .maybeSingle()

      const userPlan = (profile?.plan || 'free') as 'free' | 'pro' | 'enterprise'
      setPlan(userPlan)

      // Get usage info
      const response = await fetch('/api/audit/usage', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      let fetchedUsageInfo: UsageInfo | null = null
      if (response.ok) {
        const data = await response.json()
        setUsageInfo(data)
        fetchedUsageInfo = data
      }

      // Calculate limit based on fetched data
      const domains = fetchedUsageInfo?.domains ?? 0
      const limit = userPlan === 'free' ? 1 : userPlan === 'pro' ? 5 : Infinity
      const atLimit = userPlan === 'enterprise' ? false : domains >= limit

      return {
        isAtLimit: atLimit,
        plan: userPlan,
        currentDomains: domains,
        domainLimit: limit
      }
    } catch (error) {
      console.error("Error checking domain limit:", error)
      // Return safe defaults on error
      return {
        isAtLimit: false,
        plan: 'free',
        currentDomains: 0,
        domainLimit: 1
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Calculate if user is at limit
  const isAtLimit =
    plan === 'enterprise'
      ? false
      : plan === 'free'
        ? (usageInfo?.domains ?? 0) >= 1
        : plan === 'pro'
          ? (usageInfo?.domains ?? 0) >= 5
          : false

  // Calculate domain limit based on plan
  const domainLimit = plan === 'free' ? 1 : plan === 'pro' ? 5 : Infinity

  // Current domains from usage info
  const currentDomains = usageInfo?.domains ?? 0

  return {
    isAtLimit,
    loading,
    plan,
    currentDomains,
    domainLimit,
    checkLimit,
  }
}
