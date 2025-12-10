export const PLAN_TIERS = {
  FREE: 'free',
  PRO: 'pro',
} as const

export const PLAN_NAMES: Record<(typeof PLAN_TIERS)[keyof typeof PLAN_TIERS], string> = {
  free: 'Outpost',
  pro: 'Watchtower',
}

export type PlanTier = (typeof PLAN_TIERS)[keyof typeof PLAN_TIERS]




