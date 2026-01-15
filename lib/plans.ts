export const PLAN_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const

export const PLAN_NAMES: Record<(typeof PLAN_TIERS)[keyof typeof PLAN_TIERS], string> = {
  free: 'Tier 1',
  pro: 'Tier 2',
  enterprise: 'Tier 3',
}

export const PLAN_PRICES: Record<(typeof PLAN_TIERS)[keyof typeof PLAN_TIERS], number | null> = {
  free: 0,
  pro: 29,
  enterprise: null, // Custom pricing
}

export const PLAN_FEATURES = {
  free: {
    model: 'gpt-5.1-2025-11-13',
    maxToolCalls: 10,
    pagesAnalyzed: '2 pages (homepage + 1 key)',
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
    model: 'gpt-5.1-2025-11-13',
    maxToolCalls: 50,
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
    model: 'gpt-5.1-2025-11-13',
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




