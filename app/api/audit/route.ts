// fortress v1 - Deep Research powered audit
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateUrl } from '@/lib/url-validation'
import { auditSite, miniAudit, AuditTier } from '@/lib/audit'
import PostHogClient from '@/lib/posthog'
import { generateIssueSignature } from '@/lib/issue-signature'
import { AuditIssueGroup } from '@/lib/audit-table-adapter'
import { checkDailyLimit, checkDomainLimit, isNewDomain, incrementAuditUsage, getAuditUsage } from '@/lib/audit-rate-limit'

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
    if (token) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
      if (!userErr && userData?.user?.id) {
        userId = userData.user.id
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

    // Rate limiting checks (only for authenticated users)
    if (isAuthenticated && userId) {
      // Check if domain is new
      const domainIsNew = await isNewDomain(userId, normalized)
      
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

      // Check daily audit limit for this domain
      const dailyCheck = await checkDailyLimit(userId, normalized, plan)
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

    // Run audit based on tier
    // Free/unauthenticated: mini audit (3 pages, fast)
    // Paid/Enterprise: full audit (deep crawl)
    console.log(`[API] Running ${auditTier} audit for ${normalized}`)
    const result = auditTier === 'FREE' 
      ? await miniAudit(normalized)
      : await auditSite(normalized, auditTier)

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
          domain: normalized,
          title,
          brand_name: brandName,
          pages_scanned: 0,
          issues_json: { groups: [], auditedUrls: [], responseId: result.responseId, tier: auditTier },
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

    // Filter out ignored issues for authenticated users
    let filteredGroups = result.groups || []
    if (isAuthenticated && userId && normalized) {
      // Query ignored issue signatures for this user/domain
      const { data: ignoredStates } = await supabaseAdmin
        .from('audit_issue_states')
        .select('signature')
        .eq('user_id', userId)
        .eq('domain', normalized)
        .eq('state', 'ignored')

      if (ignoredStates && ignoredStates.length > 0) {
        const ignoredSignatures = new Set(ignoredStates.map((s) => s.signature))
        
        // Filter out groups whose signatures match ignored states
        filteredGroups = result.groups.filter((group: AuditIssueGroup) => {
          const signature = generateIssueSignature(group)
          return !ignoredSignatures.has(signature)
        })

        console.log(`[Audit] Filtered out ${result.groups.length - filteredGroups.length} ignored issues`)
      }
    }

    // Build issues JSON payload
    const issuesJson = {
      groups: filteredGroups,
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
        domain: normalized,
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
      
      // Increment audit usage (only for authenticated users, only on successful save)
      if (isAuthenticated && userId && runId) {
        try {
          await incrementAuditUsage(userId, normalized)
        } catch (error) {
          console.error('[Audit] Failed to increment audit usage:', error)
          // Don't fail the request - usage tracking is non-critical
        }
      }
    }

    // Gating: Preview shows ~5-7 issues, authenticated free shows 5, pro shows all
    // Note: groups are already filtered to exclude ignored issues above
    const groups = Array.isArray(issuesJson.groups) ? issuesJson.groups : []
    let gatedGroups = groups
    let preview = false
    
    if (!isAuthenticated) {
      // Unauthenticated preview: show 5-7 issues with fade-out
      gatedGroups = groups.slice(0, 7)
      preview = true
    } else if (plan === 'free') {
      // Authenticated free: show 5 issues
      gatedGroups = groups.slice(0, 5)
      preview = true
    } else {
      // Pro/Enterprise: show all issues
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
      groups: gatedGroups,
      totalIssues: groups.length,
      sessionToken: finalSessionToken, // Return for frontend to store
      usage, // Include usage info
      meta: { 
        pagesScanned: result.pagesScanned,
        auditedUrls: result.auditedUrls || [],
        tier: auditTier,
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


