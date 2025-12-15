/**
 * Mock audit data generator for UI testing
 * Generates realistic audit results with varied issue types
 */

import { AuditIssueGroup } from '@/lib/audit-table-adapter'

/**
 * Generate complete mock audit data with varied issue types
 * Creates 8-10 realistic issues covering all audit categories
 * 
 * @param origin - Full origin URL (e.g., 'https://example.com') or domain string
 * @param groupCount - Number of issue groups to generate (default: 10)
 */
export function createMockAuditData(origin: string = 'https://example.com', groupCount: number = 10) {
  // Normalize to base URL - handle both full URLs and domain strings
  let baseUrl: string
  try {
    // If it's already a full URL, use it; otherwise construct it
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      baseUrl = origin
    } else {
      baseUrl = `https://${origin}`
    }
  } catch {
    // Fallback if URL parsing fails
    baseUrl = `https://${origin}`
  }
  const groups: AuditIssueGroup[] = []

  // Issue templates with realistic examples
  const issueTemplates: Array<{
    title: string
    severity: 'low' | 'medium' | 'high'
    impact: string
    fix: string
    examples: Array<{ url: string; snippet: string }>
    count: number
  }> = [
    {
      title: 'Typos and Spelling Errors',
      severity: 'medium',
      impact: 'Reduces credibility and professionalism',
      fix: "Correct spelling: 'accomodate' should be 'accommodate'",
      examples: [
        { url: `${baseUrl}/about`, snippet: 'We accomodate all customer needs' },
        { url: `${baseUrl}/services`, snippet: 'Our seperate division handles this' },
      ],
      count: 3,
    },
    {
      title: 'Grammar Errors',
      severity: 'medium',
      impact: 'Makes content difficult to read and understand',
      fix: "Fix subject-verb agreement: 'The team are' should be 'The team is'",
      examples: [
        { url: `${baseUrl}/team`, snippet: 'The team are working on this project' },
        { url: `${baseUrl}/blog/post-1`, snippet: 'Each of the employees have their own desk' },
      ],
      count: 2,
    },
    {
      title: 'Punctuation Errors',
      severity: 'low',
      impact: 'Minor but affects readability',
      fix: "Add missing apostrophe: 'dont' should be 'don't'",
      examples: [
        { url: `${baseUrl}/faq`, snippet: "We dont offer refunds after 30 days" },
        { url: `${baseUrl}/contact`, snippet: 'Its important to contact us directly' },
      ],
      count: 4,
    },
    {
      title: 'Factual Contradictions',
      severity: 'high',
      impact: 'Confuses users and damages trust',
      fix: 'Standardize pricing: Use consistent pricing across all pages',
      examples: [
        { url: `${baseUrl}/pricing`, snippet: 'Starting at $29/month' },
        { url: `${baseUrl}/features`, snippet: 'Plans start at $39/month' },
      ],
      count: 1,
    },
    {
      title: 'Inconsistent Terminology',
      severity: 'medium',
      impact: 'Creates confusion about product features',
      fix: "Standardize to 'customer' across all pages (not 'client' or 'user')",
      examples: [
        { url: `${baseUrl}/`, snippet: 'Our customers love the platform' },
        { url: `${baseUrl}/testimonials`, snippet: 'Our clients report high satisfaction' },
        { url: `${baseUrl}/support`, snippet: 'Users can contact support anytime' },
      ],
      count: 5,
    },
    {
      title: 'Brand/Product Name Inconsistencies',
      severity: 'high',
      impact: 'Confuses users about product identity',
      fix: "Standardize to 'ProductName' across all pages",
      examples: [
        { url: `${baseUrl}/pricing`, snippet: 'ProductName Pro' },
        { url: `${baseUrl}/features`, snippet: 'Product-Name Plus' },
        { url: `${baseUrl}/about`, snippet: 'Product Name Enterprise' },
      ],
      count: 3,
    },
    {
      title: 'Duplicate Content Conflicts',
      severity: 'medium',
      impact: 'Conflicting information on same topic',
      fix: 'Consolidate duplicate content and remove contradictions',
      examples: [
        { url: `${baseUrl}/help`, snippet: 'Setup takes 5 minutes' },
        { url: `${baseUrl}/docs/getting-started`, snippet: 'Setup takes 10 minutes' },
      ],
      count: 2,
    },
    {
      title: 'SEO Gaps: Missing H1 Tags',
      severity: 'medium',
      impact: 'Hurts SEO and page structure',
      fix: 'Add H1 tag to each page with primary keyword',
      examples: [
        { url: `${baseUrl}/products`, snippet: 'Page has no H1 tag, only H2 headings' },
        { url: `${baseUrl}/blog`, snippet: 'Missing H1 on blog listing page' },
      ],
      count: 2,
    },
    {
      title: 'SEO Gaps: Duplicate Meta Descriptions',
      severity: 'low',
      impact: 'Reduces SEO effectiveness',
      fix: 'Create unique meta descriptions for each page',
      examples: [
        { url: `${baseUrl}/page1`, snippet: 'Meta: "Learn more about our services"' },
        { url: `${baseUrl}/page2`, snippet: 'Meta: "Learn more about our services"' },
      ],
      count: 3,
    },
    {
      title: 'Broken Links: 404 Errors',
      severity: 'high',
      impact: 'Frustrates users and hurts SEO',
      fix: 'Fix or remove broken links: Update URLs or redirect to correct pages',
      examples: [
        { url: `${baseUrl}/resources`, snippet: 'Link to /old-page returns 404' },
        { url: `${baseUrl}/docs`, snippet: 'Link to /deprecated-feature returns 404' },
      ],
      count: 2,
    },
  ]

  // Generate groups from templates, up to groupCount
  const templatesToUse = issueTemplates.slice(0, Math.min(groupCount, issueTemplates.length))
  
  for (let i = 0; i < templatesToUse.length; i++) {
    const template = templatesToUse[i]
    groups.push({
      title: template.title,
      severity: template.severity,
      impact: template.impact,
      fix: template.fix,
      examples: template.examples,
      count: template.count,
    })
  }

  // If more groups requested than templates, duplicate with variations
  if (groupCount > issueTemplates.length) {
    const additional = groupCount - issueTemplates.length
    for (let i = 0; i < additional; i++) {
      const baseTemplate = issueTemplates[i % issueTemplates.length]
      groups.push({
        title: `${baseTemplate.title} (Additional)`,
        severity: baseTemplate.severity,
        impact: baseTemplate.impact,
        fix: baseTemplate.fix,
        examples: baseTemplate.examples.map((ex) => {
          try {
            const url = new URL(ex.url)
            url.pathname = `/v${i + 2}${url.pathname}`
            return { ...ex, url: url.toString() }
          } catch {
            // Fallback if URL parsing fails
            return { ...ex, url: `${baseUrl}/v${i + 2}${ex.url.replace(baseUrl, '')}` }
          }
        }),
        count: baseTemplate.count + i,
      })
    }
  }

  // Generate audited URLs from all examples
  const auditedUrls = Array.from(
    new Set(groups.flatMap(g => g.examples.map(e => e.url)))
  )

  return {
    groups,
    pagesScanned: Math.max(3, Math.ceil(auditedUrls.length / 2)),
    auditedUrls,
  }
}

