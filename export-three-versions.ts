/**
 * Export the seline.com audit in all three PDF style versions
 * Run with: npx tsx export-three-versions.ts
 */

import fs from 'fs'
import path from 'path'

// Read the audit data
const auditData = JSON.parse(
  fs.readFileSync('parallel-audit-results-seline-com-1769533573357.json', 'utf-8')
)

// Transform parallel model issues into flat array
const allIssues: any[] = []
const models = auditData.parallelModels || {}

Object.keys(models).forEach(modelKey => {
  const modelData = models[modelKey]
  if (modelData && Array.isArray(modelData.issues)) {
    allIssues.push(...modelData.issues)
  }
})

console.log(`Found ${allIssues.length} total issues`)

// Collect unique URLs
const auditedUrls = [...new Set(allIssues.map(issue => issue.page_url).filter(Boolean))]
console.log(`Found ${auditedUrls.length} unique pages`)

// Format date
const auditDate = new Date(auditData.timestamp).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

// Count pages with issues
const pagesWithIssues = auditedUrls.length

// Generate HTML for each style
const styles: Array<'subtle-cards' | 'zebra' | 'minimal-cards'> = [
  'subtle-cards',
  'zebra',
  'minimal-cards'
]

styles.forEach((issueStyle) => {
  console.log(`\nGenerating ${issueStyle} version...`)

  // Generate the HTML with dynamic style injection
  const html = generateAuditHTML(
    'Content Audit Report',
    auditData.domain,
    auditedUrls.length,
    pagesWithIssues,
    allIssues.length,
    auditDate,
    allIssues,
    auditedUrls,
    issueStyle
  )

  // Save to file
  const filename = `seline-audit-${issueStyle}.html`
  fs.writeFileSync(filename, html)
  console.log(`✓ Saved ${filename}`)
})

console.log('\n✅ All three versions generated!')
console.log('Open each HTML file in your browser and use "Print to PDF" to create PDFs')
console.log('Files created:')
console.log('  - seline-audit-subtle-cards.html')
console.log('  - seline-audit-zebra.html')
console.log('  - seline-audit-minimal-cards.html')

// Helper function to generate HTML
function generateAuditHTML(
  title: string,
  domain: string,
  pagesAudited: number,
  pagesWithIssues: number,
  totalIssues: number,
  createdAt: string,
  issues: any[],
  auditedUrls: string[],
  issueStyle: 'subtle-cards' | 'zebra' | 'minimal-cards'
): string {
  // Count issues by severity
  const severityCounts = { critical: 0, medium: 0, low: 0 }
  issues.forEach(issue => {
    const sev = issue.severity || 'low'
    if (sev === 'critical') severityCounts.critical++
    else if (sev === 'medium') severityCounts.medium++
    else severityCounts.low++
  })

  // Build issue items
  let issuesHTML = ''
  issues.forEach((issue: any, index: number) => {
    const severity = issue.severity || 'low'
    const severityColor = severity === 'critical' ? '#7f1d1d' : severity === 'medium' ? '#78350f' : '#1e3a5f'
    const severityLabel = severity === 'critical' ? 'HIGH' : severity === 'medium' ? 'MEDIUM' : 'LOW'

    const description = issue.issue_description
    const colonIndex = description.indexOf(':')
    const impactType = colonIndex > 0 ? description.substring(0, colonIndex).trim() : 'Content Issue'
    const issueText = colonIndex > 0 ? description.substring(colonIndex + 1).trim() : description

    let itemClass = 'issue-item'
    if (issueStyle === 'zebra') {
      itemClass = index % 2 === 0 ? 'issue-item issue-zebra-even' : 'issue-item issue-zebra-odd'
    }

    issuesHTML += `
      <div class="${itemClass}">
        <div class="issue-header">
          <span class="issue-title">IMPACT: ${escapeHtml(impactType).toUpperCase()}</span>
          <span class="issue-severity" style="color: ${severityColor};">${severityLabel}</span>
        </div>

        <p class="issue-text">${escapeHtml(issueText)}</p>

        <p class="issue-fix">&rarr; ${escapeHtml(issue.suggested_fix || 'Review and update this content.')}</p>

        ${issue.page_url ? `
          <p class="issue-url">Found on: ${escapeHtml(issue.page_url)}</p>
        ` : ''}
      </div>
    `
  })

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
  <title>${escapeHtml(title)} - ${escapeHtml(domain)} (${issueStyle})</title>
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

    /* Cover page */
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

    /* Scope section */
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
      page-break-after: avoid;
    }

    /* Issue items - dynamic based on style */
    .issue-item {
      page-break-inside: avoid;
      ${issueStyle === 'subtle-cards' ? `
        margin: 0 0 24px 0;
        padding: 24px;
        background: #fafafa;
        border: none;
      ` : issueStyle === 'zebra' ? `
        margin: 0;
        padding: 20px 0;
        border-bottom: 1px solid #e4e4e7;
      ` : `
        margin: 0 0 32px 0;
        padding: 24px;
        border: 1px solid #e4e4e7;
        background: #ffffff;
      `}
    }
    .issue-item:last-child {
      ${issueStyle === 'zebra' ? 'border-bottom: none;' : ''}
      ${issueStyle === 'subtle-cards' ? 'margin-bottom: 0;' : ''}
    }

    .issue-zebra-even {
      background: #ffffff;
    }
    .issue-zebra-odd {
      background: #fafafa;
    }

    .issue-header {
      display: block;
      margin-bottom: 12px;
      line-height: 1;
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

    .issue-text {
      font-size: 14px;
      line-height: 1.6;
      color: #18181b;
      margin: 0 0 12px 0;
    }

    .issue-fix {
      font-size: 13px;
      line-height: 1.55;
      color: #52525b;
      margin: 0 0 12px 0;
    }

    .issue-url {
      font-size: 11px;
      color: #71717a;
      margin: 0;
      word-break: break-all;
    }

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

    @media print {
      .content {
        padding: 24px;
      }
      .issue-item {
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
    <div class="cover-page">
      <h1>${escapeHtml(domain)}</h1>
      <div class="cover-date">${escapeHtml(createdAt)}</div>
    </div>

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

    ${scopeHTML}

    <h2>Issues</h2>
    ${issues.length > 0 ? issuesHTML : '<p class="no-issues">No issues found in this audit.</p>'}
  </div>

  <div class="footer">
    <div class="footer-brand">Fortress</div>
    <div class="footer-meta">
      Report generated ${escapeHtml(createdAt)}
    </div>
  </div>
</body>
</html>`
}

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
