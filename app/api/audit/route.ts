// fortress v1 - Deep Research powered audit
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateUrl } from '@/lib/url-validation'
import { auditSite, miniAudit, AuditTier, AuditResult } from '@/lib/audit'
import PostHogClient from '@/lib/posthog'
import Logger from '@/lib/logger'
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

      // TEMPORARILY DISABLED: Daily limit check for testing
      // Check daily audit limit for this domain (pass email for test account exception)
      // Use storageDomain to match database format (no protocol)
      // const dailyCheck = await checkDailyLimit(userId, storageDomain, plan, userEmail)
      // if (!dailyCheck.allowed) {
      //   return NextResponse.json(
      //     {
      //       error: 'Daily limit reached',
      //       message: `You've reached your daily limit of ${dailyCheck.limit} audit${dailyCheck.limit === 1 ? '' : 's'} for this domain. Try again tomorrow or upgrade to Pro for 5 domains.`,
      //       limit: dailyCheck.limit,
      //       used: dailyCheck.used,
      //       resetAt: dailyCheck.resetAt,
      //       upgradeRequired: plan === 'free',
      //     },
      //     { status: 429 }
      //   )
      // }
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
    // VALIDATION PASSED - Create pending audit record and return immediately
    // The audit will run in background after we respond
    // ========================================================================
    
    // Create pending audit record first (so we can return runId immediately)
    const { data: run, error: runErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .insert({
        user_id: userId, // null for unauthenticated users
        session_token: isAuthenticated ? null : finalSessionToken, // only for unauthenticated
        guideline_id: guidelineId || null,
        domain: storageDomain,
        title,
        brand_name: brandName,
        pages_scanned: 0, // Will be updated when audit completes
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
    
    console.log(`[Audit] Created pending audit: ${runId}, authenticated: ${isAuthenticated}, tier: ${auditTier}`)
    
    // ========================================================================
    // RESPOND IMMEDIATELY - Dialog can close now, audit runs in background
    // ========================================================================
    
    // Start background audit (fire and forget - don't await)
    // Use an IIFE to run async code without blocking the response
    const backgroundAudit = async () => {
      try {
        let result: AuditResult

        if (useMockData) {
          // Mock data mode: generate mock audit results
          console.log(`[API] Mock data mode enabled - generating mock audit for ${normalized}`)
          
          // Simulate audit delay (2-3 seconds)
          const delay = 2000 + Math.random() * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          
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
          console.log(`[API] Running ${auditTier} audit for ${normalized} (background)`)
          result = auditTier === 'FREE' 
            ? await miniAudit(normalized)
            : await auditSite(normalized, auditTier)
        }
        
        if (result.status !== 'completed') {
          console.error(`[Audit] Background audit failed: ${result.status}`)
          // Update audit record with error status
          await supabaseAdmin
            .from('brand_audit_runs')
            .update({ 
              issues_json: { issues: [], auditedUrls: [], status: 'failed', error: 'Audit did not complete' }
            })
            .eq('id', runId)
          return
        }
        
        // Filter issues for FREE tier
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
          
          // If no issues found on homepage, log it (no mock fallback)
          if (filteredIssues.length === 0) {
            console.log(`[API] No issues found on homepage for ${normalized} - returning empty results`)
          }
        }
        
        // Update audit record with results
        const issuesJson = {
          issues: filteredIssues,
          auditedUrls: result.auditedUrls || [],
          status: 'completed',
        }
        
        const { error: updateErr } = await supabaseAdmin
          .from('brand_audit_runs')
          .update({
            pages_scanned: result.pagesScanned,
            issues_json: issuesJson,
          })
          .eq('id', runId)
        
        if (updateErr) {
          console.error('[Audit] Failed to update audit run:', updateErr)
          return
        }
        
        console.log(`[Audit] ✅ Background audit complete: ${runId}, ${filteredIssues.length} issues`)
        
        // Save issues to issues table
        if (filteredIssues.length > 0) {
          try {
            const issuesToInsert = filteredIssues.map((issue) => ({
              audit_id: runId,
              title: issue.title,
              category: issue.category || null,
              severity: issue.severity,
              impact: issue.impact || null,
              fix: issue.fix || null,
              locations: issue.locations || [],
              status: 'active',
            }))

            const { error: issuesErr } = await (supabaseAdmin as any)
              .from('issues')
              .insert(issuesToInsert)

            if (issuesErr) {
              console.error('[Audit] Failed to save issues:', issuesErr)
            } else {
              console.log(`[Audit] Saved ${issuesToInsert.length} issues to issues table`)
            }
          } catch (error) {
            console.error('[Audit] Error saving issues:', error)
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
      } catch (error) {
        console.error('[Audit] Background audit error:', error)
        // Update audit record with error status
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        await supabaseAdmin
          .from('brand_audit_runs')
          .update({ 
            issues_json: { issues: [], auditedUrls: [], status: 'failed', error: errorMessage }
          })
          .eq('id', runId)
      }
    }
    
    // Fire and forget - start audit but don't wait for it
    backgroundAudit()

    // Return immediately with pending status
    return NextResponse.json({
      runId,
      preview: !isAuthenticated,
      status: 'pending', // Changed from 'completed' - frontend should poll for results
      issues: [], // No issues yet - audit running in background
      totalIssues: 0,
      sessionToken: finalSessionToken,
      usage: null, // Will be available after audit completes
      meta: { 
        pagesScanned: 0,
        auditedUrls: [],
        tier: auditTier,
      },
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


