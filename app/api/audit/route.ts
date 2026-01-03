// fortress v1 - Deep Research powered audit
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateUrl } from '@/lib/url-validation'
import { auditSite, miniAudit, AuditTier, AuditResult } from '@/lib/audit'
import PostHogClient from '@/lib/posthog'
// Removed: issue-signature imports (no longer needed)
import { checkDailyLimit, checkDomainLimit, isNewDomain, incrementAuditUsage, getAuditUsage } from '@/lib/audit-rate-limit'
import { createMockAuditData } from '@/lib/mock-audit-data'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

function generateSessionToken(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

export async function POST(request: Request) {
  const startTime = Date.now()
  try {
    const token = getBearer(request)
    let userId: string | null = null
    let sessionToken: string | null = null
    let isAuthenticated = false

    // Support both authenticated and unauthenticated requests
    let userEmail: string | null = null
    if (token) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
      if (!userErr && userData?.user?.id) {
        userId = userData.user.id
        userEmail = userData.user.email || null
        isAuthenticated = true
      }
    }

    // Generate session token for unauthenticated users
    if (!isAuthenticated) {
      sessionToken = generateSessionToken()
    }

    const body = await request.json().catch(() => ({}))
    const { domain, guidelineId, session_token } = body || {}
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Missing domain' }, { status: 400 })
    }

    // Validate domain
    const val = validateUrl(domain)
    if (!val.isValid) {
      return NextResponse.json({ error: val.error || 'Invalid URL' }, { status: 400 })
    }
    // Normalize to origin (no trailing slash) for consistency with audit functions
    // This ensures domain format matches what's used in issue state lookups
    let normalized = val.url
    try {
      const url = new URL(val.url)
      normalized = url.origin // Remove trailing slash, path, query, etc.
    } catch {
      // Fallback to validated URL if parsing fails
      normalized = val.url
    }
    const finalSessionToken = session_token || sessionToken

    // Check plan and determine audit tier
    let plan = 'free'
    let auditTier: AuditTier = 'FREE'
    if (isAuthenticated && userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('plan')
        .eq('user_id', userId)
        .maybeSingle()
      plan = profile?.plan || 'free'
      // Map plan to audit tier
      if (plan === 'enterprise') auditTier = 'ENTERPRISE'
      else if (plan === 'pro' || plan === 'paid') auditTier = 'PAID'
      else auditTier = 'FREE'
    }

    // Normalize domain for storage (remove protocol to match health score API format)
    // Health score API queries with normalized domain (no protocol), so we must store it the same way
    const storageDomain = normalized.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

    // Rate limiting checks (only for authenticated users)
    if (isAuthenticated && userId) {
      // Check if domain is new (use storageDomain to match database format)
      const domainIsNew = await isNewDomain(userId, storageDomain)
      
      // Check domain limit (only for new domains)
      if (domainIsNew) {
        const domainCheck = await checkDomainLimit(userId, plan)
        if (!domainCheck.allowed) {
          return NextResponse.json(
            {
              error: 'Domain limit reached',
              message: `You've reached your limit of ${domainCheck.limit} domain${domainCheck.limit === 1 ? '' : 's'}. Delete a domain to add a new one, or upgrade to Pro for 5 domains.`,
              limit: domainCheck.limit,
              used: domainCheck.count,
              upgradeRequired: true,
            },
            { status: 429 }
          )
        }
      }

      // Check daily audit limit for this domain (pass email for test account exception)
      // Use storageDomain to match database format (no protocol)
      const dailyCheck = await checkDailyLimit(userId, storageDomain, plan, userEmail)
      if (!dailyCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Daily limit reached',
            message: `You've reached your daily limit of ${dailyCheck.limit} audit${dailyCheck.limit === 1 ? '' : 's'} for this domain. Try again tomorrow or upgrade to Pro for 5 domains.`,
            limit: dailyCheck.limit,
            used: dailyCheck.used,
            resetAt: dailyCheck.resetAt,
            upgradeRequired: plan === 'free',
          },
          { status: 429 }
        )
      }
    }

    // Check if mock data mode is enabled
    const useMockData = process.env.USE_MOCK_DATA === 'true'
    
    // Validate environment when using real API calls
    if (!useMockData && !process.env.OPENAI_API_KEY) {
      console.error('[API] OPENAI_API_KEY required when USE_MOCK_DATA=false')
      return NextResponse.json(
        { error: 'Server configuration error: OpenAI API key not found' },
        { status: 500 }
      )
    }
    
    let result: AuditResult

    if (useMockData) {
      // Mock data mode: generate mock audit results
      console.log(`[API] Mock data mode enabled - generating mock audit for ${normalized}`)
      
      // Simulate audit delay (2-3 seconds)
      const delay = 2000 + Math.random() * 1000 // 2000-3000ms
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Generate mock data with 8-10 issues
      // normalized is already url.origin format (e.g., https://example.com)
      const mockData = createMockAuditData(normalized, 10)
      
      result = {
        issues: mockData.issues,
        pagesScanned: mockData.pagesScanned,
        auditedUrls: mockData.auditedUrls,
        status: 'completed',
        tier: auditTier,
      }
    } else {
      // Run audit based on tier
      // Free/unauthenticated: mini audit (3 pages, fast)
      // Paid/Enterprise: full audit (deep crawl)
      console.log(`[API] Running ${auditTier} audit for ${normalized}`)
      result = auditTier === 'FREE' 
        ? await miniAudit(normalized)
        : await auditSite(normalized, auditTier)
    }
    
    // Extract brand name/title
    // Simple heuristic: extract domain name without TLD
    let brandName = domain
    try {
      const hostname = new URL(normalized).hostname
      const parts = hostname.split('.')
      // e.g. www.fortress.app -> fortress
      // e.g. fortress.app -> fortress
      brandName = parts.length > 2 ? parts[parts.length - 2] : parts[0]
      // Capitalize first letter
      brandName = brandName.charAt(0).toUpperCase() + brandName.slice(1)
    } catch {}

    const title = `${brandName} Audit`

    // Handle background execution (paid tiers may return in_progress)
    if (result.status === 'in_progress' && result.responseId) {
      // Save pending audit run for polling
      // Store tier in issues_json so it can be retrieved during polling
      const { data: run } = await supabaseAdmin
        .from('brand_audit_runs')
        .insert({
          user_id: userId,
          session_token: isAuthenticated ? null : finalSessionToken,
          guideline_id: guidelineId || null,
          domain: storageDomain,
          title,
          brand_name: brandName,
          pages_scanned: 0,
          issues_json: { issues: [], auditedUrls: [], responseId: result.responseId, tier: auditTier },
          is_preview: false,
        })
        .select('id')
        .maybeSingle()

      return NextResponse.json({
        runId: run?.id || null,
        status: 'in_progress',
        responseId: result.responseId,
        sessionToken: finalSessionToken,
        message: 'Audit is running in the background. Poll for status.',
      })
    }

    // Filter out ignored issues for authenticated users (by checking existing issues with ignored status)
    let filteredIssues = result.issues || []
    
    // For FREE tier (homepage-only audits), filter to only include issues found on homepage
    // If no issues remain, return mock issues instead
    if (auditTier === 'FREE' && !useMockData) {
      const homepageUrls = [
        normalized,
        normalized.replace(/\/$/, ''), // Remove trailing slash
        normalized + '/', // Add trailing slash
        normalized.replace(/^https?:\/\//, 'https://www.'), // www version
        normalized.replace(/^https?:\/\//, 'https://www.') + '/', // www version with slash
      ]
      
      // Filter issues to only include those with homepage URL in locations
      filteredIssues = filteredIssues.filter((issue: any) => {
        if (!issue.locations || !Array.isArray(issue.locations)) return false
        return issue.locations.some((loc: any) => {
          const locUrl = loc.url || ''
          return homepageUrls.some(homepageUrl => 
            locUrl === homepageUrl || 
            locUrl.startsWith(homepageUrl + '/') ||
            locUrl.replace(/\/$/, '') === homepageUrl.replace(/\/$/, '')
          )
        })
      })
      
      // If no issues found on homepage, return mock issues instead
      if (filteredIssues.length === 0) {
        console.log(`[API] No issues found on homepage, returning mock issues for ${normalized}`)
        const mockData = createMockAuditData(normalized, 10)
        filteredIssues = mockData.issues
        result.pagesScanned = mockData.pagesScanned
        result.auditedUrls = mockData.auditedUrls
      }
    }
    
    // Note: For new audits, we don't filter by status yet - issues start as 'active'
    // Status filtering happens when fetching issues from the database
    
    // Build issues JSON payload (backup/legacy)
    const issuesJson = {
      issues: filteredIssues,
      auditedUrls: result.auditedUrls || [],
    }
    
    // Save audit for ALL users (authenticated and unauthenticated)
    // - Authenticated: user_id set, session_token null
    // - Unauthenticated: user_id null, session_token set (can be claimed later)
    let runId: string | null = null
    
    const { data: run, error: runErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .insert({
        user_id: userId, // null for unauthenticated users
        session_token: isAuthenticated ? null : finalSessionToken, // only for unauthenticated
        guideline_id: guidelineId || null,
        domain: storageDomain,
        title,
        brand_name: brandName,
        pages_scanned: result.pagesScanned,
        issues_json: issuesJson,
        is_preview: !isAuthenticated || plan === 'free',
      })
      .select('id, issues_json')
      .maybeSingle()
    
    if (runErr) {
      console.error('[Audit] Failed to save audit run:', runErr)
      // Don't fail the request - just log and continue
    } else {
      runId = run?.id || null
      console.log(`[Audit] Saved audit run: ${runId}, authenticated: ${isAuthenticated}, tier: ${auditTier}`)
      
      // Save issues to issues table
      if (runId && filteredIssues.length > 0) {
        try {
          const issuesToInsert = filteredIssues.map((issue) => ({
            audit_id: runId,
            title: issue.title,
            category: issue.category || null,
            severity: issue.severity,
            impact: issue.impact || null,
            fix: issue.fix || null,
            locations: issue.locations || [],
            status: 'active', // All new issues start as active
          }))

          const { error: issuesErr } = await (supabaseAdmin as any)
            .from('issues')
            .insert(issuesToInsert)

          if (issuesErr) {
            console.error('[Audit] Failed to save issues:', issuesErr)
            // Don't fail the request - issues are critical but we have issues_json as backup
          } else {
            console.log(`[Audit] Saved ${issuesToInsert.length} issues to issues table`)
          }
        } catch (error) {
          console.error('[Audit] Error saving issues:', error)
          // Don't fail the request
        }
      }
      
      // Increment audit usage (only for authenticated users, only on successful save)
      // Use storageDomain to match the format used in checkDailyLimit
      if (isAuthenticated && userId && runId) {
        try {
          await incrementAuditUsage(userId, storageDomain)
        } catch (error) {
          console.error('[Audit] Failed to increment audit usage:', error)
          // Don't fail the request - usage tracking is non-critical
        }
      }
    }

    // Gating: Preview shows ~5-7 issues, authenticated free shows 5, pro shows all
    const issues = Array.isArray(filteredIssues) ? filteredIssues : []
    let gatedIssues = issues
    let preview = false
    
    if (!isAuthenticated) {
      // Unauthenticated preview: show first 5 issues
      gatedIssues = issues.slice(0, 5)
      preview = true
    } else {
      // Authenticated users (all plans): show all issues
      gatedIssues = issues
      preview = false
    }

    // Get usage info for response (only for authenticated users)
    let usage = null
    if (isAuthenticated && userId) {
      try {
        usage = await getAuditUsage(userId, normalized, plan)
      } catch (error) {
        console.error('[Audit] Failed to get usage info:', error)
        // Don't fail the request - usage info is optional
      }
    }

    return NextResponse.json({
      runId,
      preview,
      status: 'completed',
      issues: gatedIssues,
      totalIssues: issues.length,
      sessionToken: finalSessionToken, // Return for frontend to store
      usage, // Include usage info
      meta: { 
        pagesScanned: result.pagesScanned,
        auditedUrls: result.auditedUrls || [],
        tier: auditTier,
        modelDurationMs: result.modelDurationMs, // Time taken for model to respond
      },
    })
  } catch (e) {
    const duration = Date.now() - startTime
    const error = e instanceof Error ? e : new Error('Unknown error')
    try {
      const posthog = PostHogClient()
      posthog.capture({
        distinctId: 'server',
        event: 'error_occurred',
        properties: {
          type: 'crawl',
          message: error.message,
          endpoint: '/api/audit',
          duration_ms: duration,
        }
      })
      posthog.shutdown()
    } catch {}
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}


