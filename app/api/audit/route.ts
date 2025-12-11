// fortress v1
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateUrl } from '@/lib/url-validation'
import { auditSite } from '@/lib/audit'
import PostHogClient from '@/lib/posthog'

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
      const normalized = val.url

      // Temp: 3 pages for faster testing
      const pageLimit = 3
      const finalSessionToken = session_token || sessionToken

      // Check plan (only for authenticated users)
      let plan = 'free'
      if (isAuthenticated && userId) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('plan')
          .eq('user_id', userId)
          .maybeSingle()
        plan = profile?.plan || 'free'
      }

      // Audit site (crawl multiple pages)
      const result = await auditSite(normalized, pageLimit)

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

      // Build issues JSON payload
      const issuesJson = {
        groups: result.groups,
        discoveredPages: result.discoveredPages || [],
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
        console.log(`[Audit] Saved audit run: ${runId}, authenticated: ${isAuthenticated}`)
      }

      // Gating: Preview shows ~5-7 issues, authenticated free shows 5, pro shows all
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
        // Pro: show all issues
        preview = false
      }

      return NextResponse.json({
        runId,
        preview,
        groups: gatedGroups,
        totalIssues: groups.length,
        sessionToken: finalSessionToken, // Return for frontend to store
        meta: { 
          pagesScanned: result.pagesScanned,
          discoveredPages: result.discoveredPages || [],
          auditedUrls: result.auditedUrls || [],
          mapInfo: result.mapInfo || null,
        },
      })
  } catch (e) {
    const duration = Date.now() - startTime
    const error = e instanceof Error ? e : new Error('Unknown error')
    
    // Categorize error for better logging
    let errorType = 'unknown'
    let statusCode = 500
    
    if (error.message.includes('timeout') || error.message.includes('aborted')) {
      errorType = 'timeout'
      statusCode = 504
    } else if (error.message.includes('Missing domain') || error.message.includes('Invalid URL')) {
      errorType = 'validation'
      statusCode = 400
    } else if (error.message.includes('Unable to fetch') || error.message.includes('No usable content')) {
      errorType = 'crawl'
      statusCode = 422
    } else if (error.message.includes('AI service') || error.message.includes('AI model')) {
      errorType = 'ai_service'
      statusCode = 502
    } else if (error.message.includes('rate_limit') || error.message.includes('429')) {
      errorType = 'rate_limit'
      statusCode = 429
    } else if (error.message.includes('authentication') || error.message.includes('401')) {
      errorType = 'auth'
      statusCode = 500 // Don't expose auth errors to client
    }
    
    console.error(`[Audit API] Error (${errorType}):`, error.message)
    
    try {
      const posthog = PostHogClient()
      posthog.capture({
        distinctId: 'server',
        event: 'error_occurred',
        properties: {
          type: errorType,
          message: error.message,
          endpoint: '/api/audit',
          duration_ms: duration,
          status_code: statusCode,
        }
      })
      posthog.shutdown()
    } catch {}
    
    return NextResponse.json(
      { error: error.message },
      { status: statusCode }
    )
  }
}


