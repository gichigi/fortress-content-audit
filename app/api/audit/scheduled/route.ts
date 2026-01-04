// Scheduled audits execution endpoint
// Called by Vercel cron job to run weekly audits for enabled domains
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { auditSite } from '@/lib/audit'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (!cronSecret) {
    console.error('[ScheduledAudits] CRON_SECRET not configured')
    return false
  }
  
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * POST /api/audit/scheduled
 * Executes scheduled audits for all enabled domains
 * Called by Vercel cron job weekly
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Get all enabled scheduled audits where next_run is due or null
    const { data: scheduledAudits, error: fetchError } = await supabaseAdmin
      .from('scheduled_audits')
      .select('*')
      .eq('enabled', true)
      .or(`next_run.is.null,next_run.lte.${now.toISOString()}`)

    if (fetchError) {
      console.error('[ScheduledAudits] Error fetching scheduled audits:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled audits', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!scheduledAudits || scheduledAudits.length === 0) {
      return NextResponse.json({
        message: 'No scheduled audits to run',
        processed: 0,
      })
    }

    // Process each scheduled audit
    for (const scheduled of scheduledAudits) {
      results.processed++
      
      try {
        // Get user profile to determine audit tier
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('plan')
          .eq('user_id', scheduled.user_id)
          .maybeSingle()

        const plan = profile?.plan || 'free'
        
        // Only run auto audits for paid users (pro or enterprise)
        if (plan !== 'pro' && plan !== 'enterprise') {
          console.log(`[ScheduledAudits] Skipping ${scheduled.domain} - user is on ${plan} plan`)
          continue
        }

        const auditTier = plan === 'enterprise' ? 'ENTERPRISE' : 'PAID'
        
        // Normalize domain (remove protocol, www, trailing slash) to match storage format
        const normalizedDomain = scheduled.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
        
        console.log(`[ScheduledAudits] Running audit for ${normalizedDomain} (user: ${scheduled.user_id}, tier: ${auditTier})`)

        // Run the audit (use normalized domain) - all audits now complete synchronously
        const result = await auditSite(normalizedDomain, auditTier)

        // All audits complete synchronously now
        if (result.status !== 'completed') {
          console.error(`[ScheduledAudits] Unexpected audit status for ${normalizedDomain}: ${result.status}`)
          results.failed++
          results.errors.push(`${normalizedDomain}: Audit did not complete successfully`)
          continue
        }

        // Save audit run
        const issuesJson = {
          issues: result.issues || [],
          auditedUrls: result.auditedUrls || [],
        }

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('brand_audit_runs')
          .insert({
            user_id: scheduled.user_id,
            guideline_id: null,
            domain: normalizedDomain,
            pages_scanned: result.pagesScanned,
            issues_json: issuesJson,
            is_preview: false,
            scheduled_audit_id: scheduled.id,
          })
          .select('id')
          .single()

        if (insertError) {
          console.error(`[ScheduledAudits] Failed to save audit for ${normalizedDomain}:`, insertError)
          results.failed++
          results.errors.push(`${normalizedDomain}: Failed to save audit`)
          continue
        }

        // Save issues to issues table if available
        if (inserted?.id && result.issues && result.issues.length > 0) {
          try {
            const issuesToInsert = result.issues.map((issue: any) => ({
              audit_id: inserted.id,
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
              console.error(`[ScheduledAudits] Failed to save issues for ${normalizedDomain}:`, issuesErr)
            } else {
              console.log(`[ScheduledAudits] Saved ${issuesToInsert.length} issues for ${normalizedDomain}`)
            }
          } catch (error) {
            console.error(`[ScheduledAudits] Error saving issues for ${normalizedDomain}:`, error)
          }
        }

        // Update last_run and next_run (7 days from now)
        const nextRun = new Date(now)
        nextRun.setDate(nextRun.getDate() + 7)
        
        await supabaseAdmin
          .from('scheduled_audits')
          .update({
            last_run: now.toISOString(),
            next_run: nextRun.toISOString(),
          })
          .eq('id', scheduled.id)

        results.successful++
        console.log(`[ScheduledAudits] ✅ Successfully processed ${normalizedDomain}`)

      } catch (error) {
        results.failed++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        const normalizedDomain = scheduled.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
        results.errors.push(`${normalizedDomain}: ${errorMsg}`)
        console.error(`[ScheduledAudits] ❌ Failed to process ${normalizedDomain}:`, error)
      }
    }

    return NextResponse.json({
      message: 'Scheduled audits processed',
      ...results,
    })

  } catch (error) {
    console.error('[ScheduledAudits] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

