// Audit export utilities for PDF, JSON, and Markdown formats
import { AuditRun } from '@/types/fortress'
import puppeteer from 'puppeteer'

/**
 * Generate Markdown export with AI prompt header
 * Format optimized for AI consumption - users can drop into their IDE
 */
export function generateAuditMarkdown(audit: AuditRun): string {
  const issuesJson = audit.issues_json as any
  const groups = Array.isArray(issuesJson?.groups) ? issuesJson.groups : []
  const auditedUrls = Array.isArray(issuesJson?.auditedUrls) ? issuesJson.auditedUrls : []
  const domain = audit.domain || 'Unknown domain'
  const pagesScanned = audit.pages_scanned || 0
  const createdAt = audit.created_at ? new Date(audit.created_at).toLocaleDateString() : 'Unknown date'
  const totalIssues = groups.length

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
- **Pages Scanned**: ${pagesScanned}
- **Total Issues**: ${totalIssues}
- **Audit Date**: ${createdAt}

## Issues to fix:

`

  groups.forEach((group: any, index: number) => {
    const severity = group.severity || 'low'
    const severityEmoji = severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🟢'
    
    markdown += `### ${index + 1}. ${group.title || `Issue ${index + 1}`} ${severityEmoji}

**Severity**: ${severity.toUpperCase()}
**Impact**: ${group.impact || 'Not specified'}

**Suggested Fix**: ${group.fix || 'No fix provided'}

**Examples Found**:
`

    if (group.examples && Array.isArray(group.examples) && group.examples.length > 0) {
      group.examples.forEach((example: any, exIndex: number) => {
        markdown += `${exIndex + 1}. **URL**: ${example.url || 'Unknown URL'}\n`
        markdown += `   **Snippet**: "${example.snippet || 'No snippet provided'}"\n\n`
      })
    } else {
      markdown += `   No specific examples captured.\n\n`
    }

    markdown += `---\n\n`
  })

  if (auditedUrls.length > 0) {
    markdown += `## Audited URLs\n\n`
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
export function generateAuditJSON(audit: AuditRun): string {
  const issuesJson = audit.issues_json as any
  const groups = Array.isArray(issuesJson?.groups) ? issuesJson.groups : []
  const auditedUrls = Array.isArray(issuesJson?.auditedUrls) ? issuesJson.auditedUrls : []
  const tier = issuesJson?.tier || null

  const exportData = {
    domain: audit.domain,
    title: audit.title || audit.brand_name || 'Audit',
    brandName: audit.brand_name,
    pagesScanned: audit.pages_scanned || 0,
    totalIssues: groups.length,
    createdAt: audit.created_at,
    tier,
    groups,
    auditedUrls,
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Generate PDF export using Puppeteer
 * Converts HTML to PDF via headless Chrome
 */
export async function generateAuditPDF(audit: AuditRun): Promise<Blob> {
  const issuesJson = audit.issues_json as any
  const groups = Array.isArray(issuesJson?.groups) ? issuesJson.groups : []
  const auditedUrls = Array.isArray(issuesJson?.auditedUrls) ? issuesJson.auditedUrls : []
  const domain = audit.domain || 'Unknown domain'
  const pagesScanned = audit.pages_scanned || 0
  const createdAt = audit.created_at ? new Date(audit.created_at).toLocaleDateString() : 'Unknown date'
  const totalIssues = groups.length
  const title = audit.title || audit.brand_name || 'Content Audit'

  // Generate HTML content
  const html = generateAuditHTML(title, domain, pagesScanned, totalIssues, createdAt, groups, auditedUrls)

  // Launch Puppeteer with timeout handling
  // Note: In serverless environments (Vercel), you may need to use @sparticuz/chromium
  // or configure Puppeteer differently. This will work in Node.js environments.
  const PDF_TIMEOUT_MS = 45000 // 45 seconds timeout for PDF generation
  
  let browser: puppeteer.Browser | null = null
  
  try {
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
    
    // Set page timeout
    page.setDefaultTimeout(PDF_TIMEOUT_MS)
    
    // Set content with timeout
    await Promise.race([
      page.setContent(html, { waitUntil: 'networkidle0' }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Page content load timeout')), PDF_TIMEOUT_MS)
      ),
    ])
    
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
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF generation timeout after 45s')), PDF_TIMEOUT_MS)
      ),
    ])

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
  pagesScanned: number,
  totalIssues: number,
  createdAt: string,
  groups: any[],
  auditedUrls: string[]
): string {
  let issuesHTML = ''

  groups.forEach((group: any, index: number) => {
    const severity = group.severity || 'low'
    const severityClass = severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low'
    const severityColor = severity === 'high' ? '#dc2626' : severity === 'medium' ? '#f59e0b' : '#3b82f6'

    issuesHTML += `
      <div class="issue-card">
        <div class="issue-header">
          <h3>${index + 1}. ${escapeHtml(group.title || `Issue ${index + 1}`)}</h3>
          <span class="severity-badge ${severityClass}" style="background-color: ${severityColor}20; color: ${severityColor};">
            ${severity.toUpperCase()}
          </span>
        </div>
        <div class="issue-content">
          <p><strong>Impact:</strong> ${escapeHtml(group.impact || 'Not specified')}</p>
          <p><strong>Suggested Fix:</strong> ${escapeHtml(group.fix || 'No fix provided')}</p>
          ${group.examples && Array.isArray(group.examples) && group.examples.length > 0 ? `
            <div class="examples">
              <strong>Examples Found:</strong>
              <ul>
                ${group.examples.map((ex: any) => `
                  <li>
                    <strong>URL:</strong> <a href="${escapeHtml(ex.url || '')}">${escapeHtml(ex.url || 'Unknown URL')}</a><br>
                    <strong>Snippet:</strong> "${escapeHtml(ex.snippet || 'No snippet')}"
                  </li>
                `).join('')}
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
  <title>${escapeHtml(title)}</title>
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
      padding: 20px;
    }
    .cover-page {
      page-break-after: always;
      text-align: center;
      padding: 60px 20px;
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
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
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
    @media print {
      body {
        padding: 0;
      }
      .issue-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="cover-page">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <p><strong>Domain:</strong> ${escapeHtml(domain)}</p>
      <p><strong>Date:</strong> ${escapeHtml(createdAt)}</p>
      <p><strong>Pages Scanned:</strong> ${pagesScanned}</p>
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
        <strong>Pages Scanned</strong>
        <span>${pagesScanned}</span>
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
  ${issuesHTML}

  ${auditedUrls.length > 0 ? `
    <div class="audited-urls">
      <h2>Audited URLs</h2>
      <ul>
        ${auditedUrls.map(url => `<li>${escapeHtml(url)}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
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

