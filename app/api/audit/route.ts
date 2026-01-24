// fortress v1 - Deep Research powered audit
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateUrl } from '@/lib/url-validation'
import { auditSite, miniAudit, AuditTier, AuditResult, getExcludedIssues, getActiveIssues, AuditIssueContext } from '@/lib/audit'
import PostHogClient from '@/lib/posthog'
import Logger from '@/lib/logger'
import { checkDailyLimit, checkDomainLimit, isNewDomain, incrementAuditUsage, getAuditUsage } from '@/lib/audit-rate-limit'
import { createMockAuditData } from '@/lib/mock-audit-data'
import { detectMilestoneCrossings, getMilestoneToastContent } from '@/lib/milestones'

/**
 * Simple in-memory health score calculation from issues array
 * Formula: 100 - (low×1 + medium×3 + critical×7)
 */
function calculateScoreFromIssues(issues: Array<{ severity: string }>): number {
  let penalty = 0
  for (const issue of issues) {
    switch (issue.severity) {
      case 'low': penalty += 1; break
      case 'medium': penalty += 3; break
      case 'high':
      case 'critical': penalty += 7; break
    }
  }
  return Math.max(0, Math.min(100, 100 - penalty))
}

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
  let requestDomain: string | null = null // Store domain for error logging
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
    requestDomain = domain || null // Store for error logging
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Please enter a website URL to audit.' }, { status: 400 })
    }

    // Validate domain
    const val = validateUrl(domain)
    if (!val.isValid) {
      return NextResponse.json({ error: val.error || 'Please enter a valid website URL to audit.' }, { status: 400 })
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
    
    // TEMPORARY: Allow tier override via query param for testing
    const url = new URL(request.url)
    const tierOverride = url.searchParams.get('tier') as AuditTier | null
    if (tierOverride && ['FREE', 'PAID', 'ENTERPRISE'].includes(tierOverride)) {
      auditTier = tierOverride
      plan = tierOverride === 'ENTERPRISE' ? 'enterprise' : tierOverride === 'PAID' ? 'pro' : 'free'
    } else if (isAuthenticated && userId) {
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
            message: `You've reached your daily limit of ${dailyCheck.limit} audit${dailyCheck.limit === 1 ? '' : 's'} for this domain. Try again tomorrow or upgrade to Pro.`,
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
      Logger.error('[API] OPENAI_API_KEY required when USE_MOCK_DATA=false')
      return NextResponse.json(
        { error: 'Something went wrong on our end. Please contact support.' },
        { status: 500 }
      )
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
    
    // ========================================================================
    // VALIDATION PASSED - Create audit record and run audit synchronously
    // ========================================================================
    
    // Create audit record first
    const { data: run, error: runErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .insert({
        user_id: userId, // null for unauthenticated users
        session_token: isAuthenticated ? null : finalSessionToken, // only for unauthenticated
        guideline_id: guidelineId || null,
        domain: storageDomain,
        title,
        brand_name: brandName,
        pages_audited: 0, // Will be updated when audit completes
        issues_json: { issues: [], auditedUrls: [], status: 'pending' },
        is_preview: !isAuthenticated || plan === 'free',
      })
      .select('id')
      .maybeSingle()
    
    if (runErr) {
      console.error('[Audit] Failed to create pending audit run:', runErr)
      return NextResponse.json(
        { error: 'Failed to start audit. Please try again.' },
        { status: 500 }
      )
    }
    
    const runId = run?.id || null
    if (!runId) {
      return NextResponse.json(
        { error: 'Failed to create audit record. Please try again.' },
        { status: 500 }
      )
    }
    
    
    // ========================================================================
    // All tiers: Run in background via after(), return pending immediately
    // Frontend polls /api/audit/[id] for completion (supports auth token or session_token)
    // ========================================================================
    
    // Helper to run audit and save results
    const runAuditAndSave = async (): Promise<{ result: AuditResult; filteredIssues: any[] } | null> => {
      let result: AuditResult

      // Query issue context for authenticated users (for deduplication)
      let issueContext: AuditIssueContext = { excluded: [], active: [] }
      if (userId) {
        try {
          const [excluded, active] = await Promise.all([
            getExcludedIssues(userId, storageDomain),
            getActiveIssues(userId, storageDomain),
          ])
          issueContext = { excluded, active }
          if (excluded.length > 0 || active.length > 0) {
            console.log(`[API] Loaded issue context: ${excluded.length} excluded, ${active.length} active`)
          }
        } catch (error) {
          console.warn('[API] Failed to load issue context:', error instanceof Error ? error.message : error)
          // Continue without context if query fails
        }
      }

      if (useMockData) {
        console.log(`[API] Mock data mode enabled - generating mock audit for ${normalized}`)
        const delay = 2000 + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        
        const mockData = createMockAuditData(normalized, 10)
        result = {
          issues: mockData.issues,
          pagesAudited: mockData.pagesAudited,
          auditedUrls: mockData.auditedUrls,
          status: 'completed',
          tier: auditTier,
        }
      } else {
        console.log(`[API] Running ${auditTier} audit for ${normalized}`)
        result = auditTier === 'FREE'
          ? await miniAudit(normalized, undefined, issueContext, runId)
          : await auditSite(normalized, auditTier, issueContext, runId)
      }
      
      if (result.status !== 'completed') {
        console.error(`[Audit] Audit failed: ${result.status}`)
        await supabaseAdmin
          .from('brand_audit_runs')
          .update({ 
            issues_json: { issues: [], auditedUrls: [], status: 'failed', error: 'Audit did not complete' }
          })
          .eq('id', runId)
        return null
      }
      
      // Filter issues for FREE tier (homepage only)
      let filteredIssues = result.issues || []
      if (auditTier === 'FREE' && !useMockData) {
        const homepageUrls = [
          normalized,
          normalized.replace(/\/$/, ''),
          normalized + '/',
          normalized.replace(/^https?:\/\//, 'https://www.'),
          normalized.replace(/^https?:\/\//, 'https://www.') + '/',
        ]
        
        filteredIssues = filteredIssues.filter((issue: any) => {
          const issueUrl = issue.page_url || ''
          if (!issueUrl) return false
          return homepageUrls.some(homepageUrl => 
            issueUrl === homepageUrl || 
            issueUrl.startsWith(homepageUrl + '/') ||
            issueUrl.replace(/\/$/, '') === homepageUrl.replace(/\/$/, '')
          )
        })
        
        if (filteredIssues.length === 0) {
          console.log(`[API] No issues found on homepage for ${normalized} - returning empty results`)
        }
      }
      
      // Update audit record with results
      const issuesJson = {
        issues: filteredIssues,
        auditedUrls: result.auditedUrls || [],
        status: 'completed',
        tier: auditTier,
      }
      
      const { error: updateErr } = await supabaseAdmin
        .from('brand_audit_runs')
        .update({
          pages_audited: result.pagesAudited,
          issues_json: issuesJson,
        })
        .eq('id', runId)
      
      if (updateErr) {
        console.error('[Audit] Failed to update audit run:', updateErr)
      }
      
      console.log(`[Audit] ✅ Audit complete: ${runId}, ${filteredIssues.length} issues`)
      
      // Save issues to issues table
      if (filteredIssues.length > 0) {
        try {
          const issuesToInsert = filteredIssues.map((issue) => ({
            audit_id: runId,
            page_url: issue.page_url,
            category: issue.category || null,
            issue_description: issue.issue_description,
            severity: issue.severity,
            suggested_fix: issue.suggested_fix,
            status: 'active',
          }))

          const { error: issuesErr } = await (supabaseAdmin as any)
            .from('issues')
            .insert(issuesToInsert)

          if (issuesErr) {
            console.error('[Audit] Failed to save issues:', issuesErr)
          } else {
          }
        } catch (error) {
          console.error('[Audit] Error saving issues:', error)
        }
      }

      // Milestone celebration detection (only for authenticated users)
      if (isAuthenticated && userId) {
        try {
          // Calculate current health score from filtered issues
          const currentScore = calculateScoreFromIssues(filteredIssues)

          // Get previous audit's health score
          const { data: previousAudit } = await supabaseAdmin
            .from('brand_audit_runs')
            .select('id, created_at')
            .eq('user_id', userId)
            .eq('domain', storageDomain)
            .neq('id', runId) // Exclude current audit
            .not('issues_json', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          let previousScore: number | null = null
          if (previousAudit?.id) {
            // Get issues from previous audit to calculate its score
            const { data: previousIssues } = await supabaseAdmin
              .from('issues')
              .select('severity, status')
              .eq('audit_id', previousAudit.id)

            if (previousIssues && previousIssues.length > 0) {
              // Only count active issues for previous score
              const activePreviousIssues = previousIssues.filter(i => i.status === 'active')
              previousScore = calculateScoreFromIssues(activePreviousIssues)
            } else {
              // No issues means perfect score
              previousScore = 100
            }
          }

          // Get or create scheduled_audits record to track celebrated milestones
          const { data: scheduledAudit, error: scheduledAuditErr } = await supabaseAdmin
            .from('scheduled_audits')
            .select('celebrated_milestones, enabled')
            .eq('user_id', userId)
            .eq('domain', storageDomain)
            .maybeSingle()

          if (scheduledAuditErr && scheduledAuditErr.code !== 'PGRST116') {
            console.error('[Audit] Error fetching scheduled_audits:', scheduledAuditErr)
          }

          const celebratedMilestones = scheduledAudit?.celebrated_milestones || []

          // Detect milestone crossings
          const crossedMilestones = detectMilestoneCrossings(
            previousScore,
            currentScore,
            celebratedMilestones
          )

          if (crossedMilestones.length > 0) {
            console.log(`[Audit] Milestones crossed: ${crossedMilestones.join(', ')}`)

            // Upsert scheduled_audits record with new celebrated milestones
            const updatedCelebratedMilestones = [...celebratedMilestones, ...crossedMilestones]

            const { error: upsertErr } = await supabaseAdmin
              .from('scheduled_audits')
              .upsert({
                user_id: userId,
                domain: storageDomain,
                celebrated_milestones: updatedCelebratedMilestones,
                enabled: scheduledAudit?.enabled ?? false,
              }, {
                onConflict: 'user_id,domain'
              })

            if (upsertErr) {
              console.error('[Audit] Error updating celebrated_milestones:', upsertErr)
            }

            // Store milestone data in issues_json for frontend to display toast
            const updatedIssuesJson = {
              ...issuesJson,
              milestones: crossedMilestones.map(m => getMilestoneToastContent(m))
            }

            await supabaseAdmin
              .from('brand_audit_runs')
              .update({ issues_json: updatedIssuesJson })
              .eq('id', runId)
          }
        } catch (error) {
          console.error('[Audit] Error detecting milestones:', error)
          // Don't fail the audit if milestone detection fails
        }
      }

      // Increment audit usage (only for authenticated users)
      if (isAuthenticated && userId) {
        try {
          await incrementAuditUsage(userId, storageDomain)
        } catch (error) {
          console.error('[Audit] Failed to increment audit usage:', error)
        }
      }
      
      return { result, filteredIssues }
    }
    
    // All tiers: Run in background, return pending immediately
    const runAuditBackground = async () => {
      try {
        await runAuditAndSave()
      } catch (error) {
        console.error('[Audit] Background audit error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        try {
          const { error: updateError } = await supabaseAdmin
            .from('brand_audit_runs')
            .update({
              issues_json: { issues: [], auditedUrls: [], status: 'failed', error: errorMessage }
            })
            .eq('id', runId)

          if (updateError) {
            console.error('[Audit] Failed to update audit status to failed:', updateError)
          } else {
            console.log('[Audit] Successfully updated audit status to failed:', runId)
          }
        } catch (dbError) {
          console.error('[Audit] Database error updating failed status:', dbError)
        }
      }
    }
    
    // Use Next.js after() to run audit in background after response is sent
    after(runAuditBackground)
    
    // Return immediately so frontend can show toast and start polling
    return NextResponse.json({
      runId,
      status: 'pending',
      message: 'Audit started. Poll /api/audit/[id] for results.',
      sessionToken: finalSessionToken,
      tier: auditTier.toLowerCase() as 'free' | 'pro' | 'enterprise',
    })
  } catch (e) {
    const duration = Date.now() - startTime
    const error = e instanceof Error ? e : new Error('Unknown error')
    
    // Log error - simplified for expected errors, detailed for unexpected
    const isExpectedError = error.message.includes('bot protection') || 
                           error.message.includes('Daily limit') ||
                           error.message.includes('Invalid domain') ||
                           error.message.includes('Domain limit')
    
    if (isExpectedError) {
      // For expected errors, log only message without full stack
      Logger.error(`[API] Audit error: ${error.message}`, undefined, {
        domain: requestDomain || 'unknown',
        duration_ms: duration,
      })
    } else {
      // For unexpected errors, log with context but truncate stack in production
      Logger.error('[API] Audit error', error, {
        domain: requestDomain || 'unknown',
        duration_ms: duration,
        // Only include full stack in development
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
      })
    }
    
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
          domain: requestDomain || 'unknown',
        }
      })
      posthog.shutdown()
    } catch {}
    
    // Return user-friendly error message (error.message is already sanitized by handleAuditError)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Vercel function config - extend timeout for long-running audits
// Vercel timeout limits (2025):
// - Hobby: up to 60s
// - Pro: up to 300s (5min) without Fluid Compute, up to 800s (~13.3min) with Fluid Compute
// - Enterprise: up to 900s (15min) or 800s with Fluid Compute
// Current setting: 800s requires Pro with Fluid Compute or Enterprise plan
export const maxDuration = 800 // ~13.3 minutes (requires Pro with Fluid Compute or Enterprise)
