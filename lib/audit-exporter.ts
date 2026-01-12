// Audit export utilities for PDF, JSON, and Markdown formats
import { AuditRun, Issue } from '@/types/fortress'
import puppeteer from 'puppeteer'

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
  const pagesAudited = audit.pages_audited || audit.pages_scanned || 0
  // Calculate pages with issues from issue locations
  const pagesWithIssues = new Set<string>()
  issues.forEach(issue => {
    if (issue.locations && Array.isArray(issue.locations)) {
      issue.locations.forEach(loc => {
        if (loc.url) {
          try {
            const url = new URL(loc.url)
            pagesWithIssues.add(url.pathname || '/')
          } catch {
            // Invalid URL, skip
          }
        }
      })
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
    pagesAudited: audit.pages_audited || audit.pages_scanned || 0,
    totalIssues: issues.length,
    createdAt: audit.created_at,
    tier,
    issues,
    auditedUrls,
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Generate PDF export using Puppeteer
 * Converts HTML to PDF via headless Chrome
 */
export async function generateAuditPDF(audit: AuditRun, issues: Issue[]): Promise<Blob> {
  const issuesJson = audit.issues_json as any
  const auditedUrls = Array.isArray(issuesJson?.auditedUrls) ? issuesJson.auditedUrls : []
  const domain = audit.domain || 'Unknown domain'
  const pagesAudited = audit.pages_audited || audit.pages_scanned || 0
  // Calculate pages with issues from issue page_url
  const pagesWithIssues = new Set<string>()
  issues.forEach(issue => {
    if (issue.page_url) {
      try {
        const url = new URL(issue.page_url)
        pagesWithIssues.add(url.pathname || '/')
      } catch {
        // Invalid URL, skip
      }
    }
  })
  const pagesWithIssuesCount = pagesWithIssues.size
  const createdAt = audit.created_at ? new Date(audit.created_at).toLocaleDateString() : 'Unknown date'
  const totalIssues = issues.length
  const title = audit.title || audit.brand_name || 'Content Audit'

  // Generate HTML content
  const html = generateAuditHTML(title, domain, pagesAudited, pagesWithIssuesCount, totalIssues, createdAt, issues, auditedUrls)

  // Launch Puppeteer with timeout handling
  // Note: In serverless environments (Vercel), you may need to use @sparticuz/chromium
  // or configure Puppeteer differently. This will work in Node.js environments.
  const PDF_TIMEOUT_MS = 45000 // 45 seconds timeout for PDF generation
  
  let browser: puppeteer.Browser | null = null
  
  try {
    // Debug: Log HTML length and issues count
    console.log('[PDF Export] Generating PDF:', {
      htmlLength: html.length,
      issuesCount: issues.length,
      domain: audit.domain,
    })

    const launchPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // May be needed for serverless
      ],
    })

    // Timeout for browser launch (10 seconds)
    browser = await Promise.race([
      launchPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Puppeteer launch timeout after 10s')), 10000)
      ),
    ])

    const page = await browser.newPage()
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 })
    
    // Set page timeout
    page.setDefaultTimeout(PDF_TIMEOUT_MS)
    
    // Set content with timeout - use 'domcontentloaded' for faster rendering
    await Promise.race([
      page.setContent(html, { waitUntil: 'domcontentloaded' }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Page content load timeout')), PDF_TIMEOUT_MS)
      ),
    ])
    
    // Wait a bit for styles to apply (using Promise-based setTimeout)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Generate PDF with timeout
    const pdfBuffer = await Promise.race([
      page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        preferCSSPageSize: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF generation timeout after 45s')), PDF_TIMEOUT_MS)
      ),
    ])

    console.log('[PDF Export] PDF generated successfully:', {
      bufferSize: pdfBuffer.length,
      domain: audit.domain,
    })

    return new Blob([pdfBuffer], { type: 'application/pdf' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown PDF generation error'
    console.error('[Audit Exporter] PDF generation failed:', {
      error: errorMessage,
      domain: audit.domain,
      auditId: audit.id,
      timestamp: new Date().toISOString(),
    })
    throw new Error(`PDF generation failed: ${errorMessage}`)
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('[Audit Exporter] Error closing browser:', closeError)
      }
    }
  }
}

/**
 * Generate HTML content for PDF conversion
 */
function generateAuditHTML(
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
        <div class="issue-header">
          <h3>${index + 1}. ${escapeHtml(issueText || `Issue ${index + 1}`)}</h3>
          <span class="severity-badge ${severityClass}" style="background-color: ${severityColor}20; color: ${severityColor};">
            ${severity.toUpperCase()}
          </span>
        </div>
        <div class="issue-content">
          ${impactPrefix ? `<p><strong>Impact:</strong> ${escapeHtml(impactPrefix)}</p>` : ''}
          <p><strong>Suggested Fix:</strong> ${escapeHtml(issue.suggested_fix || 'No fix provided')}</p>
          ${issue.page_url ? `
            <div class="examples">
              <strong>Page Found:</strong>
              <ul>
                <li>
                  <strong>URL:</strong> <a href="${escapeHtml(issue.page_url)}">${escapeHtml(issue.page_url)}</a>
                </li>
              </ul>
            </div>
          ` : ''}
        </div>
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
      line-height: 1.6;
      color: #1a1a1a;
      padding: 0;
      background: #ffffff;
      margin: 0;
    }
    .header {
      background: #ffffff;
      border-bottom: 2px solid #e5e5e5;
      padding: 20px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-text {
      font-size: 24px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .header-tagline {
      font-size: 12px;
      color: #666;
      margin-left: 12px;
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
      text-align: center;
      padding: 80px 40px 60px 40px;
    }
    .cover-page h1 {
      font-size: 2.5em;
      margin-bottom: 20px;
      color: #1a1a1a;
    }
    .cover-page .meta {
      margin-top: 40px;
      font-size: 1.1em;
      color: #666;
    }
    .cover-page .meta p {
      margin: 10px 0;
    }
    .summary {
      background: #f5f5f5;
      padding: 24px;
      border-radius: 8px;
      margin: 40px 0;
      border: 1px solid #e5e5e5;
    }
    .summary h2 {
      margin-bottom: 15px;
      font-size: 1.5em;
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
      margin-bottom: 5px;
      color: #666;
      font-size: 0.9em;
    }
    .summary-item span {
      font-size: 1.2em;
      color: #1a1a1a;
    }
    .issue-card {
      margin: 30px 0;
      padding: 20px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      page-break-inside: avoid;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e5e5e5;
    }
    .issue-header h3 {
      font-size: 1.3em;
      flex: 1;
      margin-right: 15px;
      color: #1a1a1a;
      font-weight: 600;
    }
    .severity-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: bold;
      white-space: nowrap;
    }
    .issue-content {
      margin-top: 15px;
    }
    .issue-content p {
      margin: 10px 0;
      color: #333;
    }
    .issue-content strong {
      color: #1a1a1a;
      font-weight: 600;
    }
    .examples {
      margin-top: 15px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .examples ul {
      margin-top: 10px;
      padding-left: 20px;
    }
    .examples li {
      margin: 10px 0;
      padding: 10px;
      background: white;
      border-radius: 4px;
    }
    .examples a {
      color: #3b82f6;
      text-decoration: none;
    }
    .audited-urls {
      margin-top: 30px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .audited-urls h2 {
      margin-bottom: 15px;
    }
    .audited-urls ul {
      list-style: none;
      padding-left: 0;
    }
    .audited-urls li {
      padding: 5px 0;
      border-bottom: 1px solid #e5e5e5;
    }
    h2 {
      color: #1a1a1a;
      font-weight: 600;
      margin-top: 30px;
      margin-bottom: 15px;
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

