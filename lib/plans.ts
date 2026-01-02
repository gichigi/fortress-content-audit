export const PLAN_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const

export const PLAN_NAMES: Record<(typeof PLAN_TIERS)[keyof typeof PLAN_TIERS], string> = {
  free: 'Outpost',
  pro: 'Watchtower',
  enterprise: 'Fortress',
}

export const PLAN_PRICES: Record<(typeof PLAN_TIERS)[keyof typeof PLAN_TIERS], number | null> = {
  free: 0,
  pro: 29,
  enterprise: null, // Custom pricing
}

export const PLAN_FEATURES = {
  free: {
    model: 'o4-mini-deep-research',
    maxToolCalls: 5,
    pagesAnalyzed: '3 pages (homepage + 2 key)',
    issueCategories: 'High-signal only',
    issuesShown: '3 (preview with fade-out)',
    exportFormat: 'None',
    issueManagement: true,
    historicalReports: false,
    monitoring: false,
    seoGaps: true,
    brokenLinksDetection: true,
    competitorAnalysis: false,
    customAuditRequests: false,
    iaTaxonomyRecommendations: false,
    teamSharing: false,
    webhookSupport: false,
    realTimeAlerts: false,
    auditsPerDay: '1 audit per day',
    autoWeeklyAudits: false,
  },
  pro: {
    model: 'o3-deep-research',
    maxToolCalls: 25,
    pagesAnalyzed: '10-20 important pages',
    issueCategories: 'All categories',
    issuesShown: 'All issues',
    exportFormat: 'PDF, JSON, Markdown',
    issueManagement: true,
    historicalReports: true,
    monitoring: true,
    seoGaps: true,
    brokenLinksDetection: true,
    competitorAnalysis: false,
    customAuditRequests: false,
    iaTaxonomyRecommendations: false,
    teamSharing: false,
    webhookSupport: false,
    realTimeAlerts: false,
    auditsPerDay: '1 audit per day',
    autoWeeklyAudits: true,
  },
  enterprise: {
    model: 'o3-deep-research',
    maxToolCalls: 100,
    pagesAnalyzed: 'Full-site analysis',
    issueCategories: 'All categories + custom',
    issuesShown: 'All issues',
    exportFormat: 'PDF, JSON, Markdown',
    issueManagement: true,
    historicalReports: true,
    monitoring: true,
    seoGaps: true,
    competitorAnalysis: true,
    customAuditRequests: true,
    brokenLinksDetection: true,
    iaTaxonomyRecommendations: true,
    teamSharing: true,
    webhookSupport: true,
    realTimeAlerts: true,
    auditsPerDay: '1 audit per day',
    autoWeeklyAudits: true,
  },
}

export type PlanTier = (typeof PLAN_TIERS)[keyof typeof PLAN_TIERS]




