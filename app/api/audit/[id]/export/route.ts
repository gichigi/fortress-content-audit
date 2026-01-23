// Export audit in various formats (PDF, JSON, Markdown)
// Available to all authenticated users
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAuditMarkdown, generateAuditJSON, generateAuditHTML } from '@/lib/audit-exporter'
import PostHogClient from '@/lib/posthog'
import Logger from '@/lib/logger'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Immediately await params to prevent Next.js 15 enumeration warnings
  const { id } = await params
  const startTime = Date.now()
  try {
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 })
    }
    const userId = userData.user.id

    // Get format from query params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    
    // Validate format
    if (!['pdf', 'json', 'md'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Please use pdf, json, or md.' }, { status: 400 })
    }

    // Exports are available to all authenticated users (no plan gating)

    // Fetch audit
    const { data: audit, error: fetchErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchErr) {
      Logger.error('[Export] Error fetching audit', fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr)))
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    if (!audit) {
      return NextResponse.json({ error: 'The requested audit was not found.' }, { status: 404 })
    }

    // Fetch issues from database (single source of truth)
    const { data: issues, error: issuesErr } = await (supabaseAdmin as any)
      .from('issues')
      .select('*')
      .eq('audit_id', id)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: true })

    if (issuesErr) {
      Logger.error('[Export] Error fetching issues', issuesErr instanceof Error ? issuesErr : new Error(String(issuesErr)))
      return NextResponse.json({ error: 'Something went wrong fetching issues. Please try again.' }, { status: 500 })
    }

    const issuesList = issues || []

    // Debug: Log issues count
    console.log('[Export] Exporting audit:', {
      auditId: id,
      domain: audit.domain,
      format,
      issuesCount: issuesList.length,
    })

    // Generate filename
    const domain = audit.domain || 'audit'
    const sanitizedDomain = domain.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const date = audit.created_at 
      ? new Date(audit.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    // Generate export based on format
    const startTime = Date.now()
    switch (format) {
      case 'md': {
        try {
          const markdown = generateAuditMarkdown(audit, issuesList)
          const duration = Date.now() - startTime
          
          // Log successful export
          try {
            const posthog = PostHogClient()
            posthog.capture({
              distinctId: userId,
              event: 'audit_exported',
              properties: {
                format: 'md',
                auditId: id,
                domain: audit.domain,
                duration_ms: duration,
                success: true,
              },
            })
            posthog.shutdown()
          } catch (phError) {
            console.error('[Export] PostHog error:', phError)
          }
          
          return new NextResponse(markdown, {
            headers: {
              'Content-Type': 'text/markdown',
              'Content-Disposition': `attachment; filename="${sanitizedDomain}-audit-${date}.md"`,
            },
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate Markdown'
          console.error('[Export] Markdown generation error:', {
            error: errorMessage,
            auditId: id,
            domain: audit.domain,
            userId,
            format: 'md',
            timestamp: new Date().toISOString(),
          })
          throw error
        }
      }

      case 'json': {
        try {
          const json = generateAuditJSON(audit, issuesList)
          const duration = Date.now() - startTime
          
          // Log successful export
          try {
            const posthog = PostHogClient()
            posthog.capture({
              distinctId: userId,
              event: 'audit_exported',
              properties: {
                format: 'json',
                auditId: id,
                domain: audit.domain,
                duration_ms: duration,
                success: true,
              },
            })
            posthog.shutdown()
          } catch (phError) {
            console.error('[Export] PostHog error:', phError)
          }
          
          return new NextResponse(json, {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="${sanitizedDomain}-audit-${date}.json"`,
            },
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate JSON'
          console.error('[Export] JSON generation error:', {
            error: errorMessage,
            auditId: id,
            domain: audit.domain,
            userId,
            format: 'json',
            timestamp: new Date().toISOString(),
          })
          throw error
        }
      }

      case 'pdf': {
        try {
          // Generate HTML content on server for client-side PDF conversion
          const auditedUrls = Array.isArray(audit.issues_json?.auditedUrls) ? audit.issues_json.auditedUrls : []
          const domain = audit.domain || 'Unknown domain'
          const pagesAudited = audit.pages_audited || 0

          // Calculate pages with issues from issue page_url
          const pagesWithIssues = new Set<string>()
          issuesList.forEach(issue => {
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
          const totalIssues = issuesList.length
          const title = audit.title || audit.brand_name || 'Content Audit'

          const html = generateAuditHTML(title, domain, pagesAudited, pagesWithIssuesCount, totalIssues, createdAt, issuesList, auditedUrls)
          const duration = Date.now() - startTime

          // Log successful HTML generation
          try {
            const posthog = PostHogClient()
            posthog.capture({
              distinctId: userId,
              event: 'audit_exported',
              properties: {
                format: 'pdf',
                auditId: id,
                domain: audit.domain,
                duration_ms: duration,
                success: true,
                conversionMethod: 'client-side',
              },
            })
            posthog.shutdown()
          } catch (phError) {
            // Don't fail export if PostHog fails
            console.error('[Export] PostHog error:', phError)
          }

          return new NextResponse(html, {
            headers: {
              'Content-Type': 'text/html',
              'Content-Disposition': `attachment; filename="${sanitizedDomain}-audit-${date}.html"`,
              'X-PDF-Conversion': 'client-side',
            },
          })
        } catch (error) {
          const duration = Date.now() - startTime
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF'

          // Log export failure with details
          console.error('[Export] PDF generation error:', {
            error: errorMessage,
            auditId: id,
            domain: audit.domain,
            userId,
            format: 'pdf',
            duration_ms: duration,
            timestamp: new Date().toISOString(),
          })

          // Track export failure in PostHog
          try {
            const posthog = PostHogClient()
            posthog.capture({
              distinctId: userId,
              event: 'audit_export_failed',
              properties: {
                format: 'pdf',
                auditId: id,
                domain: audit.domain,
                error: errorMessage,
                duration_ms: duration,
              },
            })
            posthog.shutdown()
          } catch (phError) {
            console.error('[Export] PostHog error:', phError)
          }

          return NextResponse.json(
            {
              error: 'Failed to generate PDF. Please try again or export as Markdown/JSON instead.'
            },
            { status: 500 }
          )
        }
      }

      default:
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error')
    const duration = Date.now() - startTime
    
    // Log general export failure (id and userId may not be in scope if error occurred early)
    console.error('[Export] Export error:', {
      error: error.message,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    })
    
    // Track in PostHog (only if we have userId)
    try {
      // Try to get userId from error context if available
      const posthog = PostHogClient()
      posthog.capture({
        distinctId: 'server',
        event: 'audit_export_failed',
        properties: {
          error: error.message,
          duration_ms: duration,
        },
      })
      posthog.shutdown()
    } catch (phError) {
      // PostHog errors are non-critical, log silently
    }
    
    // Return user-friendly error message
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

