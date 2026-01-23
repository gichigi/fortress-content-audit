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
      
      markdown += `### ${index + 1}. ${issueText} ${severityEmoji}

**Severity**: ${severity.toUpperCase()}
${impactPrefix ? `**Impact**: ${impactPrefix}\n` : ''}
**Suggested Fix**: ${issue.suggested_fix || 'No fix provided'}

**Page Found**:
`

      if (issue.page_url) {
        markdown += `**URL**: ${issue.page_url}\n\n`
      } else {
        markdown += `   No specific page captured.\n\n`
      }

      markdown += `---\n\n`
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
  let issuesHTML = ''

  // Validate issues array
  if (!Array.isArray(issues)) {
    console.error('[PDF Export] Issues is not an array:', typeof issues)
    issues = []
  }

  issues.forEach((issue: Issue, index: number) => {
    const severity = issue.severity || 'low'
    const severityClass = severity === 'critical' ? 'high' : severity === 'medium' ? 'medium' : 'low'
    const severityColor = severity === 'critical' ? '#dc2626' : severity === 'medium' ? '#f59e0b' : '#3b82f6'

    // Parse issue_description to extract impact and description
    const description = issue.issue_description
    const colonIndex = description.indexOf(':')
    const impactPrefix = colonIndex > 0 ? description.substring(0, colonIndex).trim() : ''
    const issueText = colonIndex > 0 ? description.substring(colonIndex + 1).trim() : description

    issuesHTML += `
      <div class="issue-card">
        <div class="issue-meta">
          <span class="issue-number">${index + 1}.</span>
          <span class="impact-badge">${escapeHtml(impactPrefix || 'general').toUpperCase()}</span>
          <span class="severity-badge ${severityClass}" style="color: ${severityColor};">
            ${severity.toUpperCase()}
          </span>
        </div>

        <div class="issue-section">
          <div class="section-label">Issue</div>
          <div class="section-content">${escapeHtml(issueText || `Issue ${index + 1}`)}</div>
        </div>

        <div class="issue-section">
          <div class="section-label">Suggested Fix</div>
          <div class="section-content">${escapeHtml(issue.suggested_fix || 'No fix provided')}</div>
        </div>

        ${issue.page_url ? `
          <div class="issue-section page-section">
            <div class="section-label">Page Found</div>
            <a href="${escapeHtml(issue.page_url)}" class="page-url">${escapeHtml(issue.page_url)}</a>
          </div>
        ` : ''}
      </div>
    `
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - Fortress Content Audit</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #334155;
      padding: 0;
      background: #ffffff;
      margin: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .header {
      background: #ffffff;
      border-bottom: 1px solid #e5e5e5;
      padding: 32px 40px;
      margin-bottom: 0;
    }
    .header-brand {
      display: block;
    }
    .header-text {
      font-size: 20px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.01em;
      line-height: 1.3;
      display: block;
      margin-bottom: 4px;
    }
    .header-tagline {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 500;
      line-height: 1.4;
      display: block;
    }
    .content {
      padding: 40px;
    }
    .footer {
      margin-top: 60px;
      padding: 30px 40px;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .footer-text {
      font-size: 16px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .footer-link {
      color: #3B82F6;
      text-decoration: none;
      font-weight: 500;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
    .cover-page {
      page-break-after: always;
      padding: 120px 40px 60px 40px;
    }
    .cover-page h1 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 48px;
      font-weight: 300;
      line-height: 1.1;
      margin-bottom: 24px;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .cover-page .meta {
      margin-top: 48px;
      font-size: 14px;
      color: #64748b;
      line-height: 1.8;
    }
    .cover-page .meta p {
      margin: 12px 0;
    }
    .cover-page .meta strong {
      color: #0f172a;
      font-weight: 600;
    }
    .summary {
      background: #f8fafc;
      padding: 32px;
      border-radius: 0;
      margin: 48px 0;
      border: 1px solid #e2e8f0;
    }
    .summary h2 {
      margin-bottom: 24px;
      font-size: 24px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    .summary-item {
      padding: 10px;
      background: white;
      border-radius: 4px;
    }
    .summary-item strong {
      display: block;
      margin-bottom: 8px;
      color: #64748b;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary-item span {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
    }
    .issue-card {
      margin: 24px 0;
      padding: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 0;
      page-break-inside: avoid;
      background: #ffffff;
    }
    .issue-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f1f5f9;
      line-height: 1;
    }
    .issue-number {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      margin-right: 4px;
      line-height: 1.2;
    }
    .impact-badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      line-height: 1.2;
      padding-top: 2px;
    }
    .severity-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
      margin-left: auto;
      line-height: 1;
      display: inline-block;
    }
    .issue-section {
      margin-bottom: 16px;
    }
    .issue-section:last-child {
      margin-bottom: 0;
    }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      margin-bottom: 8px;
      line-height: 1.4;
      display: block;
    }
    .section-content {
      font-size: 16px;
      line-height: 1.6;
      color: #334155;
      display: block;
    }
    .page-section {
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
    }
    .page-url {
      color: #3b82f6;
      text-decoration: none;
      word-break: break-all;
      font-size: 14px;
      line-height: 1.6;
    }
    .audited-urls {
      margin-top: 48px;
      padding: 24px;
      background: #f8fafc;
      border-radius: 0;
      border: 1px solid #e2e8f0;
    }
    .audited-urls h2 {
      margin-bottom: 16px;
    }
    .audited-urls ul {
      list-style: none;
      padding-left: 0;
    }
    .audited-urls li {
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
    }
    .audited-urls li:last-child {
      border-bottom: none;
    }
    h2 {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 28px;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.01em;
      margin-top: 48px;
      margin-bottom: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 12px;
    }
    @media print {
      body {
        padding: 0;
      }
      .header {
        padding: 15px 20px;
      }
      .content {
        padding: 20px;
      }
      .footer {
        padding: 20px;
        margin-top: 40px;
      }
      .issue-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-brand">
      <span class="header-text">Fortress</span>
      <span class="header-tagline">Content Audit Report</span>
    </div>
  </div>

  <div class="content">
    <div class="cover-page">
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <p><strong>Domain:</strong> ${escapeHtml(domain)}</p>
        <p><strong>Date:</strong> ${escapeHtml(createdAt)}</p>
        <p><strong>Pages Audited:</strong> ${pagesAudited}</p>
        <p><strong>Pages with Issues:</strong> ${pagesWithIssues}${pagesAudited > 0 ? ` (${pagesWithIssues}/${pagesAudited})` : ''}</p>
        <p><strong>Total Issues:</strong> ${totalIssues}</p>
      </div>
    </div>

    <div class="summary">
    <h2>Audit Summary</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <strong>Domain</strong>
        <span>${escapeHtml(domain)}</span>
      </div>
      <div class="summary-item">
        <strong>Pages Audited</strong>
        <span>${pagesAudited}</span>
      </div>
      <div class="summary-item">
        <strong>Pages with Issues</strong>
        <span>${pagesWithIssues}${pagesAudited > 0 ? ` / ${pagesAudited}` : ''}</span>
      </div>
      <div class="summary-item">
        <strong>Total Issues</strong>
        <span>${totalIssues}</span>
      </div>
      <div class="summary-item">
        <strong>Audit Date</strong>
        <span>${escapeHtml(createdAt)}</span>
      </div>
    </div>
  </div>

  <h2 style="margin-top: 40px; margin-bottom: 20px;">Issues Found</h2>
  ${issues.length > 0 ? issuesHTML : '<p style="color: #666; font-style: italic;">No issues found in this audit.</p>'}

  ${auditedUrls.length > 0 ? `
    <div class="audited-urls">
      <h2>Pages Opened</h2>
      <ul>
        ${auditedUrls.map(url => `<li>${escapeHtml(url)}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
  </div>

  <div class="footer">
    <div class="footer-brand">
      <span class="footer-text">Fortress</span>
    </div>
    <p>Generated by <a href="https://aistyleguide.com" class="footer-link">Fortress</a> - Content quality audit platform</p>
    <p style="margin-top: 8px; color: #999;">This report was automatically generated from your content audit</p>
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

