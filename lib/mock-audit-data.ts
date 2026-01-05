/**
 * Mock audit data generator for UI testing
 * Generates realistic audit results with varied issue types
 */

/**
 * Generate complete mock audit data with varied issue types
 * Creates 8-10 realistic issues covering all audit categories
 * 
 * @param origin - Full origin URL (e.g., 'https://example.com') or domain string
 * @param issueCount - Number of issues to generate (default: 10)
 */
export function createMockAuditData(origin: string = 'https://example.com', issueCount: number = 10) {
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
  const issues: Array<{
    title: string
    category?: string
    severity: 'low' | 'medium' | 'high'
    impact: string
    fix: string
    locations: Array<{ url: string; snippet: string }>
  }> = []

  // Issue templates with realistic examples
  const issueTemplates: Array<{
    title: string
    category?: string
    severity: 'low' | 'medium' | 'high'
    impact: string
    fix: string
    locations: Array<{ url: string; snippet: string }>
  }> = [
    {
      title: "Fix typo: 'suport' → 'support'",
      category: 'typos',
      severity: 'medium',
      impact: 'Reduces credibility and professionalism',
      fix: "Correct spelling: 'suport' should be 'support'",
      locations: [
        { url: `${baseUrl}/contact`, snippet: 'Contact our suport team for help' },
      ],
    },
    {
      title: "Fix typo: 'suport' → 'support'",
      category: 'typos',
      severity: 'medium',
      impact: 'Reduces credibility and professionalism',
      fix: "Correct spelling: 'suport' should be 'support'",
      locations: [
        { url: `${baseUrl}/help`, snippet: 'Need suport? Email us' },
      ],
    },
    {
      title: "Fix typo: 'accomodate' → 'accommodate'",
      category: 'typos',
      severity: 'medium',
      impact: 'Reduces credibility and professionalism',
      fix: "Correct spelling: 'accomodate' should be 'accommodate'",
      locations: [
        { url: `${baseUrl}/about`, snippet: 'We accomodate all customer needs' },
      ],
    },
    {
      title: "Fix typo: 'accomodate' → 'accommodate'",
      category: 'typos',
      severity: 'medium',
      impact: 'Reduces credibility and professionalism',
      fix: "Correct spelling: 'accomodate' should be 'accommodate'",
      locations: [
        { url: `${baseUrl}/services`, snippet: 'We can accomodate large teams' },
      ],
    },
    {
      title: "Fix grammar: 'The team are' → 'The team is'",
      category: 'grammar',
      severity: 'medium',
      impact: 'Makes content difficult to read and understand',
      fix: "Fix subject-verb agreement: 'The team are' should be 'The team is'",
      locations: [
        { url: `${baseUrl}/team`, snippet: 'The team are working on this project' },
      ],
    },
    {
      title: "Fix punctuation: 'dont' → 'don't'",
      category: 'punctuation',
      severity: 'low',
      impact: 'Minor but affects readability',
      fix: "Add missing apostrophe: 'dont' should be 'don't'",
      locations: [
        { url: `${baseUrl}/faq`, snippet: "We dont offer refunds after 30 days" },
      ],
    },
    {
      title: "Fix punctuation: 'dont' → 'don't'",
      category: 'punctuation',
      severity: 'low',
      impact: 'Minor but affects readability',
      fix: "Add missing apostrophe: 'dont' should be 'don't'",
      locations: [
        { url: `${baseUrl}/terms`, snippet: 'You dont need to register' },
      ],
    },
    {
      title: "Pricing conflict: $29 vs $39",
      category: 'factual',
      severity: 'high',
      impact: 'Confuses users and damages trust',
      fix: 'Standardize pricing: Use consistent pricing across all pages',
      locations: [
        { url: `${baseUrl}/pricing`, snippet: 'Starting at $29/month' },
        { url: `${baseUrl}/features`, snippet: 'Plans start at $39/month' },
      ],
    },
    {
      title: "Terminology inconsistency: 'customer' vs 'client' vs 'user'",
      category: 'terminology',
      severity: 'medium',
      impact: 'Creates confusion about product features',
      fix: "Standardize to 'customer' across all pages (not 'client' or 'user')",
      locations: [
        { url: `${baseUrl}/`, snippet: 'Our customers love the platform' },
        { url: `${baseUrl}/testimonials`, snippet: 'Our clients report high satisfaction' },
        { url: `${baseUrl}/support`, snippet: 'Users can contact support anytime' },
      ],
    },
    {
      title: "Product name formatting inconsistency",
      category: 'terminology',
      severity: 'high',
      impact: 'Confuses users about product identity',
      fix: "Standardize to 'ProductName' across all pages",
      locations: [
        { url: `${baseUrl}/pricing`, snippet: 'ProductName Pro' },
        { url: `${baseUrl}/features`, snippet: 'Product-Name Plus' },
        { url: `${baseUrl}/about`, snippet: 'Product Name Enterprise' },
      ],
    },
    {
      title: "Setup time conflict: 5 minutes vs 10 minutes",
      category: 'factual',
      severity: 'medium',
      impact: 'Conflicting information on same topic',
      fix: 'Consolidate duplicate content and remove contradictions',
      locations: [
        { url: `${baseUrl}/help`, snippet: 'Setup takes 5 minutes' },
        { url: `${baseUrl}/docs/getting-started`, snippet: 'Setup takes 10 minutes' },
      ],
    },
    {
      title: 'Add H1 tag',
      category: 'seo',
      severity: 'medium',
      impact: 'Hurts SEO and page structure',
      fix: 'Add H1 tag to each page with primary keyword',
      locations: [
        { url: `${baseUrl}/products`, snippet: 'Page has no H1 tag, only H2 headings' },
      ],
    },
    {
      title: 'Add H1 tag',
      category: 'seo',
      severity: 'medium',
      impact: 'Hurts SEO and page structure',
      fix: 'Add H1 tag to each page with primary keyword',
      locations: [
        { url: `${baseUrl}/blog`, snippet: 'Missing H1 on blog listing page' },
      ],
    },
    {
      title: 'Duplicate meta description',
      category: 'seo',
      severity: 'low',
      impact: 'Reduces SEO effectiveness',
      fix: 'Create unique meta descriptions for each page',
      locations: [
        { url: `${baseUrl}/page1`, snippet: 'Meta: "Learn more about our services"' },
        { url: `${baseUrl}/page2`, snippet: 'Meta: "Learn more about our services"' },
      ],
    },
    {
      title: 'Fix broken link: /old-page returns 404',
      category: 'links',
      severity: 'high',
      impact: 'Frustrates users and hurts SEO',
      fix: 'Fix or remove broken links: Update URLs or redirect to correct pages',
      locations: [
        { url: `${baseUrl}/resources`, snippet: 'Link to /old-page returns 404' },
      ],
    },
    {
      title: 'Fix broken link: /deprecated-feature returns 404',
      category: 'links',
      severity: 'high',
      impact: 'Frustrates users and hurts SEO',
      fix: 'Fix or remove broken links: Update URLs or redirect to correct pages',
      locations: [
        { url: `${baseUrl}/docs`, snippet: 'Link to /deprecated-feature returns 404' },
      ],
    },
  ]

  // Generate issues from templates, up to issueCount
  const templatesToUse = issueTemplates.slice(0, Math.min(issueCount, issueTemplates.length))
  
  for (let i = 0; i < templatesToUse.length; i++) {
    const template = templatesToUse[i]
    issues.push({
      title: template.title,
      category: template.category,
      severity: template.severity,
      impact: template.impact,
      fix: template.fix,
      locations: template.locations,
    })
  }

  // If more issues requested than templates, duplicate with variations
  if (issueCount > issueTemplates.length) {
    const additional = issueCount - issueTemplates.length
    for (let i = 0; i < additional; i++) {
      const baseTemplate = issueTemplates[i % issueTemplates.length]
      issues.push({
        title: `${baseTemplate.title} (Additional)`,
        category: baseTemplate.category,
        severity: baseTemplate.severity,
        impact: baseTemplate.impact,
        fix: baseTemplate.fix,
        locations: baseTemplate.locations.map((loc) => {
          try {
            const url = new URL(loc.url)
            url.pathname = `/v${i + 2}${url.pathname}`
            return { ...loc, url: url.toString() }
          } catch {
            // Fallback if URL parsing fails
            return { ...loc, url: `${baseUrl}/v${i + 2}${loc.url.replace(baseUrl, '')}` }
          }
        }),
      })
    }
  }

  // Generate audited URLs from all locations
  const auditedUrls = Array.from(
    new Set(issues.flatMap(issue => issue.locations.map(loc => loc.url)))
  )

  return {
    issues,
    pagesAudited: auditedUrls.length > 0 ? auditedUrls.length : 1,
    auditedUrls,
  }
}

