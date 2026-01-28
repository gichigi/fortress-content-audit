// Audit export utilities for PDF, JSON, and Markdown formats
import { AuditRun, Issue } from '@/types/fortress'

/**
 * Generate Markdown export with AI prompt header
 * Format optimized for AI consumption - users can drop into their IDE
 */
export function generateAuditMarkdown(audit: AuditRun, issues: Issue[]): string {
  const issuesJson = audit.issues_json as any
  const domain = audit.domain || 'Unknown domain'
  
  // Filter auditedUrls to only include URLs from the audit domain
  // Also include URLs from issues to ensure consistency with dashboard
  const rawAuditedUrls = Array.isArray(issuesJson?.auditedUrls) ? issuesJson.auditedUrls : []
  const issueUrls = issues
    .map(issue => issue.page_url)
    .filter((url): url is string => !!url && typeof url === 'string')
  
  // Extract domain from audit domain (handle both with and without protocol)
  let auditDomain: string | null = null
  try {
    const domainUrl = domain.startsWith('http') ? domain : `https://${domain}`
    const urlObj = new URL(domainUrl)
    auditDomain = urlObj.hostname
  } catch {
    // If domain parsing fails, use domain as-is
    auditDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
  
  // Filter URLs to only include those from the audit domain
  const auditedUrls = [...new Set([...rawAuditedUrls, ...issueUrls])]
    .filter((url: string) => {
      if (!url || typeof url !== 'string') return false
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
        return urlObj.hostname === auditDomain || urlObj.hostname.endsWith(`.${auditDomain}`)
      } catch {
        return false
      }
    })
  const pagesAudited = audit.pages_audited || audit.pages_audited || 0
  // Calculate pages with issues from issue page_url
  const pagesWithIssues = new Set<string>()
  issues.forEach(issue => {
    if (issue.page_url) {
      try {
        const url = new URL(issue.page_url)
        pagesWithIssues.add(url.pathname || '/')
      } catch {
        // Invalid URL or relative path, use as-is
        pagesWithIssues.add(issue.page_url)
      }
    }
  })
  const pagesWithIssuesCount = pagesWithIssues.size
  const createdAt = audit.created_at ? new Date(audit.created_at).toLocaleDateString() : 'Unknown date'
  const totalIssues = issues.length

  let markdown = `# Content Audit Issues - Fix Required

You are reviewing a content audit report. Below are content quality issues found on a website.
Each issue includes: title, severity, impact, suggested fix, and examples with URLs where the issue was found.

Your task: For each issue listed below, provide the corrected content that fixes the problem.
When fixing issues:
- Apply the suggested fix provided
- Maintain the original tone and style
- Ensure fixes are consistent across all instances
- Preserve URLs and structure

## Audit Metadata

- **Domain**: ${domain}
- **Pages Audited**: ${pagesAudited}
- **Pages with Issues**: ${pagesWithIssuesCount}${pagesAudited > 0 ? ` (${pagesWithIssuesCount}/${pagesAudited})` : ''}
- **Total Issues**: ${totalIssues}
- **Audit Date**: ${createdAt}

## Issues to fix:

`

  if (issues.length === 0) {
    markdown += `\nNo issues found in this audit.\n\n`
  } else {
    issues.forEach((issue: Issue, index: number) => {
      const severity = issue.severity || 'low'
      const severityEmoji = severity === 'critical' ? '🔴' : severity === 'medium' ? '🟡' : '🟢'

      // Parse issue_description to extract impact and description
      const description = issue.issue_description
      const colonIndex = description.indexOf(':')
      const impactPrefix = colonIndex > 0 ? description.substring(0, colonIndex).trim() : ''
      const issueText = colonIndex > 0 ? description.substring(colonIndex + 1).trim() : description

      // Make title clickable if URL exists
      const title = issue.page_url
        ? `[${index + 1}. ${issueText}](${issue.page_url}) ${severityEmoji}`
        : `${index + 1}. ${issueText} ${severityEmoji}`

      markdown += `### ${title}

**Severity**: ${severity.toUpperCase()}
${impactPrefix ? `**Impact**: ${impactPrefix}\n` : ''}
**Suggested Fix**: ${issue.suggested_fix || 'No fix provided'}

---

`
    })
  }

  if (auditedUrls.length > 0) {
    markdown += `## Pages Opened\n\n`
    auditedUrls.forEach((url: string) => {
      markdown += `- ${url}\n`
    })
  }

  return markdown
}

/**
 * Generate JSON export
 * Straightforward implementation using JSON.stringify
 */
export function generateAuditJSON(audit: AuditRun, issues: Issue[]): string {
  const issuesJson = audit.issues_json as any
  const auditedUrls = Array.isArray(issuesJson?.auditedUrls) ? issuesJson.auditedUrls : []
  const tier = issuesJson?.tier || null

  const exportData = {
    domain: audit.domain,
    title: audit.title || audit.brand_name || 'Audit',
    brandName: audit.brand_name,
    pagesAudited: audit.pages_audited || audit.pages_audited || 0,
    totalIssues: issues.length,
    createdAt: audit.created_at,
    tier,
    issues,
    auditedUrls,
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Generate HTML content for PDF conversion
 * Design: Editorial, premium aesthetic with muted colors and generous spacing
 */
export function generateAuditHTML(
  title: string,
  domain: string,
  pagesAudited: number,
  pagesWithIssues: number,
  totalIssues: number,
  createdAt: string,
  issues: Issue[],
  auditedUrls: string[]
): string {
  // Validate issues array
  if (!Array.isArray(issues)) {
    console.error('[PDF Export] Issues is not an array:', typeof issues)
    issues = []
  }

  // Count issues by severity for summary
  const severityCounts = { critical: 0, medium: 0, low: 0 }
  issues.forEach(issue => {
    const sev = issue.severity || 'low'
    if (sev === 'critical') severityCounts.critical++
    else if (sev === 'medium') severityCounts.medium++
    else severityCounts.low++
  })

  // Format date as "January 28, 2026"
  const formatFullDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }
  const formattedDate = formatFullDate(createdAt)

  // Build issue cards with streamlined design
  let firstIssueHTML = ''
  let remainingIssuesHTML = ''

  issues.forEach((issue: Issue, index: number) => {
    const severity = issue.severity || 'low'
    // Muted severity colors
    const severityColor = severity === 'critical' ? '#7f1d1d' : severity === 'medium' ? '#78350f' : '#1e3a5f'
    const severityLabel = severity === 'critical' ? 'HIGH' : severity === 'medium' ? 'MEDIUM' : 'LOW'

    // Parse issue_description to extract impact type and description
    const description = issue.issue_description
    const colonIndex = description.indexOf(':')
    const impactType = colonIndex > 0 ? description.substring(0, colonIndex).trim() : 'Content Issue'
    const issueText = colonIndex > 0 ? description.substring(colonIndex + 1).trim() : description


    const issueCard = `
      <div class="issue-item">
        <div class="issue-header">
          ${issue.page_url ? `
            <a href="${escapeHtml(issue.page_url)}" class="issue-title-link">
              <span class="issue-title">IMPACT: ${escapeHtml(impactType).toUpperCase()}</span>
            </a>
          ` : `
            <span class="issue-title">IMPACT: ${escapeHtml(impactType).toUpperCase()}</span>
          `}
          <span class="issue-severity" style="color: ${severityColor};">${severityLabel}</span>
        </div>

        <p class="issue-text">${escapeHtml(issueText)}</p>

        ${issue.page_url ? `<p class="issue-url">Found on: <a href="${escapeHtml(issue.page_url)}" class="issue-url-link">${escapeHtml(issue.page_url)}</a></p>` : ''}

        <p class="issue-fix">&rarr; ${escapeHtml(issue.suggested_fix || 'Review and update this content.')}</p>
      </div>
    `

    if (index === 0) {
      firstIssueHTML = issueCard
    } else {
      remainingIssuesHTML += issueCard
    }
  })

  // Build scope/pages audited section
  const scopeHTML = auditedUrls.length > 0 ? `
    <div class="scope-section">
      <h2>Scope of Audit</h2>
      <p class="scope-intro">${auditedUrls.length} page${auditedUrls.length !== 1 ? 's' : ''} analyzed for content quality issues.</p>
      <ul class="scope-list">
        ${auditedUrls.map(url => `<li>${escapeHtml(url)}</li>`).join('')}
      </ul>
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - Content Audit</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 15px;
      line-height: 1.65;
      color: #18181b;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    /* Editorial headline font stack */
    .headline-font {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
    }

    /* Header */
    .header {
      padding: 28px 40px;
      border-bottom: 1px solid #e4e4e7;
    }
    .header-text {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #18181b;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .header-tagline {
      font-size: 10px;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 500;
      margin-top: 4px;
    }

    /* Content wrapper */
    .content {
      padding: 32px 40px;
    }

    /* Cover page - simplified */
    .cover-page {
      page-break-after: always;
      padding: 80px 0 40px 0;
    }
    .cover-page h1 {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
      font-size: 52px;
      font-weight: 300;
      line-height: 1.05;
      color: #18181b;
      letter-spacing: -0.02em;
      margin-bottom: 0;
    }
    .cover-date {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
      font-size: 15px;
      font-weight: 400;
      font-style: italic;
      color: #71717a;
      margin-top: 24px;
      letter-spacing: 0.01em;
    }

    /* Summary section */
    .summary {
      background: #fafafa;
      padding: 20px 28px 24px 28px;
      margin: 0 0 40px 0;
      border: 1px solid #e4e4e7;
    }
    .summary h2 {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
      font-size: 18px;
      font-weight: 500;
      color: #18181b;
      letter-spacing: -0.01em;
      margin-top: 0;
      margin-bottom: 16px;
      padding-bottom: 0;
      border-bottom: none;
    }

    /* Summary rows - table-like layout for html2pdf compatibility */
    .summary-row {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e4e4e7;
    }
    .summary-row:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .summary-row-inner {
      display: block;
    }
    .summary-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #71717a;
      margin-bottom: 5px;
    }
    .summary-value {
      font-size: 16px;
      font-weight: 600;
      color: #18181b;
    }
    .summary-value-small {
      font-size: 14px;
      font-weight: 500;
      color: #52525b;
    }

    /* Severity breakdown inline */
    .severity-breakdown {
      margin-top: 6px;
      font-size: 12px;
      color: #52525b;
    }
    .severity-breakdown span {
      margin-right: 12px;
    }
    .sev-critical { color: #7f1d1d; }
    .sev-medium { color: #78350f; }
    .sev-low { color: #1e3a5f; }

    /* Scope section - appears after summary */
    .scope-section {
      background: #fafafa;
      padding: 16px 28px 20px 28px;
      margin-bottom: 40px;
      border: 1px solid #e4e4e7;
    }
    .scope-section h2 {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
      font-size: 16px;
      font-weight: 500;
      color: #18181b;
      margin-top: 0;
      margin-bottom: 8px;
      padding-bottom: 0;
      border-bottom: none;
    }
    .scope-intro {
      font-size: 13px;
      color: #52525b;
      margin-bottom: 12px;
    }
    .scope-list {
      list-style: none;
      padding: 0;
      margin: 0;
      column-count: 2;
      column-gap: 24px;
    }
    .scope-list li {
      font-size: 12px;
      color: #71717a;
      padding: 4px 0;
      border-bottom: 1px solid #e4e4e7;
      break-inside: avoid;
      word-break: break-all;
    }
    .scope-list li:last-child {
      border-bottom: none;
    }

    /* Section headings */
    h2 {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
      font-size: 26px;
      font-weight: 500;
      color: #18181b;
      letter-spacing: -0.01em;
      margin-top: 40px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e4e4e7;
    }

    /* Wrapper to keep Issues heading with first issue */
    .issues-heading-wrapper {
      page-break-before: always;
      page-break-inside: avoid;
    }

    /* Issue items - subtle cards style */
    .issue-item {
      page-break-inside: avoid;
      margin: 0 0 24px 0;
      padding: 24px;
      background: #fafafa;
      border: none;
    }
    .issue-item:last-child {
      margin-bottom: 0;
    }

    /* Issue header - title left, severity right */
    .issue-header {
      display: block;
      margin-bottom: 12px;
      line-height: 1;
    }
    .issue-title-link {
      text-decoration: none;
      color: inherit;
    }
    .issue-title-link:hover .issue-title {
      color: #52525b;
    }
    .issue-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #18181b;
    }
    .issue-severity {
      float: right;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* Issue text */
    .issue-text {
      font-size: 14px;
      line-height: 1.6;
      color: #18181b;
      margin: 0 0 12px 0;
    }

    /* Issue URL */
    .issue-url {
      font-size: 11px;
      line-height: 1.5;
      color: #71717a;
      margin: 0 0 12px 0;
      word-break: break-all;
    }
    .issue-url-link {
      color: #52525b;
      text-decoration: none;
    }
    .issue-url-link:hover {
      text-decoration: underline;
    }

    /* Issue fix */
    .issue-fix {
      font-size: 13px;
      line-height: 1.55;
      color: #52525b;
      margin: 0;
    }

    /* No issues state */
    .no-issues {
      color: #71717a;
      font-style: italic;
      padding: 32px 0;
    }

    /* Footer */
    .footer {
      margin-top: 48px;
      padding: 24px 40px;
      border-top: 1px solid #e4e4e7;
      text-align: center;
    }
    .footer-brand {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #18181b;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .footer-meta {
      font-size: 12px;
      color: #71717a;
    }
    .footer-link {
      color: #52525b;
      text-decoration: none;
    }

    /* Print styles */
    @media print {
      .content {
        padding: 24px;
      }
      .issue-card {
        page-break-inside: avoid;
      }
      .scope-list {
        column-count: 1;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-text">Fortress</div>
    <div class="header-tagline">Content Audit Report</div>
  </div>

  <div class="content">
    <!-- Cover page - simplified -->
    <div class="cover-page">
      <h1>${escapeHtml(domain)}</h1>
      <div class="cover-date">${escapeHtml(formattedDate)}</div>
    </div>

    <!-- Summary section -->
    <div class="summary">
      <h2>Summary</h2>

      <div class="summary-row">
        <div class="summary-row-inner">
          <div class="summary-label">Domain</div>
          <div class="summary-value-small">${escapeHtml(domain)}</div>
        </div>
      </div>

      <div class="summary-row">
        <div class="summary-row-inner">
          <div class="summary-label">Pages Audited</div>
          <div class="summary-value">${pagesAudited}</div>
        </div>
      </div>

      <div class="summary-row">
        <div class="summary-row-inner">
          <div class="summary-label">Issues Found</div>
          <div class="summary-value">${totalIssues}</div>
          ${totalIssues > 0 ? `
            <div class="severity-breakdown">
              ${severityCounts.critical > 0 ? `<span class="sev-critical">${severityCounts.critical} Critical</span>` : ''}
              ${severityCounts.medium > 0 ? `<span class="sev-medium">${severityCounts.medium} Medium</span>` : ''}
              ${severityCounts.low > 0 ? `<span class="sev-low">${severityCounts.low} Low</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <div class="summary-row">
        <div class="summary-row-inner">
          <div class="summary-label">Pages with Issues</div>
          <div class="summary-value-small">${pagesWithIssues}${pagesAudited > 0 ? ` of ${pagesAudited}` : ''}</div>
        </div>
      </div>
    </div>

    <!-- Scope section - shows pages audited -->
    ${scopeHTML}

    <!-- Issues section -->
    ${issues.length > 0 ? `
      <div class="issues-heading-wrapper">
        <h2>Issues</h2>
      </div>
      ${firstIssueHTML}
      ${remainingIssuesHTML}
    ` : `
      <h2>Issues</h2>
      <p class="no-issues">No issues found in this audit.</p>
    `}
  </div>

  <div class="footer">
    <div class="footer-brand">Fortress</div>
    <div class="footer-meta">
      Report generated ${escapeHtml(formattedDate)}
    </div>
  </div>
</body>
</html>`
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

