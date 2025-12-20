// Poll background audit status (for paid/enterprise tiers)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pollAuditStatus, AuditTier } from '@/lib/audit'
// Removed: issue-signature imports (no longer needed)
import { incrementAuditUsage, getAuditUsage } from '@/lib/audit-rate-limit'
import { emailService } from '@/lib/email-service'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

export async function POST(request: Request) {
  try {
    const token = getBearer(request)
    let userId: string | null = null
    let isAuthenticated = false

    // Support both authenticated and unauthenticated requests
    if (token) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
      if (!userErr && userData?.user?.id) {
        userId = userData.user.id
        isAuthenticated = true
      }
    }

    const body = await request.json().catch(() => ({}))
    const { responseId, runId, session_token } = body || {}

    if (!responseId) {
      return NextResponse.json({ error: 'Missing responseId' }, { status: 400 })
    }

    // Retrieve tier and queued_count from database if runId is provided
    let tier: AuditTier | undefined = undefined
    let queuedCount = 0
    if (runId) {
      // Support both authenticated (user_id) and unauthenticated (session_token) lookups
      let query = supabaseAdmin
        .from('brand_audit_runs')
        .select('issues_json, user_id, session_token')
        .eq('id', runId)
      
      if (isAuthenticated && userId) {
        query = query.eq('user_id', userId)
      } else if (session_token) {
        query = query.eq('session_token', session_token)
      } else {
        // If no auth and no session_token, try to find by responseId in issues_json
        query = query.or(`user_id.is.null,session_token.not.is.null`)
      }
      
      const { data: auditRun } = await query.maybeSingle()
      
      if (auditRun?.issues_json && typeof auditRun.issues_json === 'object') {
        const issuesJson = auditRun.issues_json as any
        if ('tier' in issuesJson) {
          const storedTier = issuesJson.tier
          // Validate tier is a valid AuditTier
          if (storedTier === 'FREE' || storedTier === 'PAID' || storedTier === 'ENTERPRISE') {
            tier = storedTier as AuditTier
            console.log(`[Poll] Retrieved tier ${tier} from database for runId: ${runId}`)
          }
        }
        // Get queued_count if it exists
        if (typeof issuesJson.queued_count === 'number') {
          queuedCount = issuesJson.queued_count
        }
      }
    }

    console.log(`[Poll] Checking status for responseId: ${responseId}${tier ? ` (tier: ${tier})` : ''}${isAuthenticated ? ' (authenticated)' : ' (unauthenticated)'}, queued_count: ${queuedCount}`)
    const result = await pollAuditStatus(responseId, tier)

    // If still in progress or queued, check for queued timeout
    if (result.status === 'in_progress' || result.status === 'queued') {
      // Only increment queued_count if status is actually "queued"
      const isQueued = result.status === 'queued' || result.rawStatus === 'queued'
      const newQueuedCount = isQueued ? queuedCount + 1 : 0 // Reset if not queued
      
      // Check queued timeout thresholds (generous since user isn't waiting)
      const QUEUED_THRESHOLDS = {
        FREE: 30,    // 30 polls × 5s = 150 seconds (2.5 minutes)
        PAID: 60,   // 60 polls × 5s = 300 seconds (5 minutes)
        ENTERPRISE: 120, // 120 polls × 5s = 600 seconds (10 minutes)
      }
      
      const threshold = tier ? QUEUED_THRESHOLDS[tier] : QUEUED_THRESHOLDS.PAID
      
      // If queued count exceeds threshold, cancel and return error
      if (isQueued && newQueuedCount >= threshold) {
        console.warn(`[Poll] Queued timeout exceeded (${newQueuedCount} >= ${threshold}) for ${tier || 'unknown'} tier, cancelling: ${responseId}`)
        
        // Try to cancel the response
        try {
          const OpenAI = (await import('openai')).default
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          // Cancel the response (if SDK supports it)
          await (openai.responses as any).cancel?.(responseId).catch((err: any) => {
            console.warn(`[Poll] Failed to cancel response (may not be supported): ${err.message}`)
          })
        } catch (cancelError) {
          console.warn(`[Poll] Error cancelling response: ${cancelError instanceof Error ? cancelError.message : 'Unknown'}`)
        }
        
        // Update database to mark as failed
        if (runId) {
          const issuesJson = {
            issues: [],
            auditedUrls: [],
            tier: tier || 'PAID',
            queued_count: newQueuedCount,
            error: 'queued_timeout',
          }
          
          let updateQuery = supabaseAdmin
            .from('brand_audit_runs')
            .update({ issues_json: issuesJson })
            .eq('id', runId)
          
          if (isAuthenticated && userId) {
            updateQuery = updateQuery.eq('user_id', userId)
          } else if (session_token) {
            updateQuery = updateQuery.eq('session_token', session_token)
          }
          
          await updateQuery
        }
        
        return NextResponse.json({
          status: 'failed',
          error: 'queued_timeout',
          message: `Audit was queued for too long. Please try again.`,
          responseId,
        }, { status: 200 }) // 200 so frontend can handle it
      }
      
      // Update queued_count in database if runId exists and count changed
      if (runId && newQueuedCount !== queuedCount) {
        let query = supabaseAdmin
          .from('brand_audit_runs')
          .select('issues_json')
          .eq('id', runId)
        
        if (isAuthenticated && userId) {
          query = query.eq('user_id', userId)
        } else if (session_token) {
          query = query.eq('session_token', session_token)
        }
        
        const { data: auditRun } = await query.maybeSingle()
        if (auditRun?.issues_json && typeof auditRun.issues_json === 'object') {
          const issuesJson = { ...auditRun.issues_json as any, queued_count: newQueuedCount }
          
          let updateQuery = supabaseAdmin
            .from('brand_audit_runs')
            .update({ issues_json: issuesJson })
            .eq('id', runId)
          
          if (isAuthenticated && userId) {
            updateQuery = updateQuery.eq('user_id', userId)
          } else if (session_token) {
            updateQuery = updateQuery.eq('session_token', session_token)
          }
          
          await updateQuery.catch((err) => {
            console.warn(`[Poll] Failed to update queued_count: ${err.message}`)
          })
        }
      }
      
      console.log(`[Poll] Audit still in progress: ${responseId} (queued_count: ${newQueuedCount}/${threshold})`)
      return NextResponse.json({
        status: 'in_progress',
        responseId,
        message: 'Audit is still running. Check back in a few seconds.',
        progress: {
          pagesScanned: result.pagesScanned || 0,
          issuesFound: result.issues?.length || 0,
          auditedUrls: result.auditedUrls || [],
          reasoningSummaries: result.reasoningSummaries || [],
        },
      })
    }

    // Audit completed - update the database record if we have a runId
    if (runId) {
      // Get audit domain and email status for filtering ignored issues and sending email
      let query = supabaseAdmin
        .from('brand_audit_runs')
        .select('domain, completion_email_sent, user_id, session_token')
        .eq('id', runId)
      
      if (isAuthenticated && userId) {
        query = query.eq('user_id', userId)
      } else if (session_token) {
        query = query.eq('session_token', session_token)
      }
      
      const { data: auditRun } = await query.maybeSingle()

      // Note: For new audits, we don't filter by status yet - issues start as 'active'
      // Status filtering happens when fetching issues from the database
      const filteredIssues = result.issues || []

      const issuesJson = {
        issues: filteredIssues,
        auditedUrls: result.auditedUrls || [],
        tier: result.tier || tier, // Preserve tier for future lookups
        queued_count: 0, // Reset queued_count on completion
      }

      let updateQuery = supabaseAdmin
        .from('brand_audit_runs')
        .update({
          pages_scanned: result.pagesScanned,
          issues_json: issuesJson,
        })
        .eq('id', runId)
      
      if (isAuthenticated && userId) {
        updateQuery = updateQuery.eq('user_id', userId)
      } else if (session_token) {
        updateQuery = updateQuery.eq('session_token', session_token)
      }
      
      const { error: updateErr } = await updateQuery

      if (updateErr) {
        console.error('[Poll] Failed to update audit run:', updateErr)
      } else {
        console.log(`[Poll] ✅ Audit completed and updated: ${runId} (${result.issues?.length || 0} issues, ${result.pagesScanned || 0} pages)`)
        
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
              status: 'active', // All new issues start as active
            }))

            const { error: issuesErr } = await (supabaseAdmin as any)
              .from('issues')
              .insert(issuesToInsert)

            if (issuesErr) {
              console.error('[Poll] Failed to save issues:', issuesErr)
              // Don't fail the request - issues are critical but we have issues_json as backup
            } else {
              console.log(`[Poll] Saved ${issuesToInsert.length} issues to issues table`)
            }
          } catch (error) {
            console.error('[Poll] Error saving issues:', error)
            // Don't fail the request
          }
        }
        
        // Increment audit usage when audit completes (only for authenticated users)
        if (auditRun?.domain && isAuthenticated && userId) {
          try {
            await incrementAuditUsage(userId, auditRun.domain)
          } catch (error) {
            console.error('[Poll] Failed to increment audit usage:', error)
            // Don't fail the request - usage tracking is non-critical
          }
        }

        // Send completion email if not already sent (only for authenticated users)
        if (!auditRun?.completion_email_sent && userId) {
          try {
            // Get user email and name
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
            const userEmail = userData?.user?.email
            const userName = userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name

            if (userEmail) {
              const emailResult = await emailService.sendAuditCompletionEmail({
                customerEmail: userEmail,
                customerName: userName,
                domain: auditRun.domain || 'your website',
                totalIssues: filteredIssues.length,
                pagesScanned: result.pagesScanned || 0,
                auditId: runId,
              })

              if (emailResult.success) {
                // Mark email as sent
                await supabaseAdmin
                  .from('brand_audit_runs')
                  .update({ completion_email_sent: true })
                  .eq('id', runId)
                  .eq('user_id', userId)
                
                console.log(`[Poll] Sent completion email for audit: ${runId}`)
              } else {
                console.error('[Poll] Failed to send completion email:', emailResult.error)
              }
            }
          } catch (error) {
            console.error('[Poll] Error sending completion email:', error)
            // Don't fail the request - email is non-critical
          }
        }
      }
    }

    // Get filtered issues (or use result.issues if filtering wasn't done)
    let responseIssues = result.issues || []
    if (runId) {
      let query = supabaseAdmin
        .from('brand_audit_runs')
        .select('domain, issues_json')
        .eq('id', runId)
      
      if (isAuthenticated && userId) {
        query = query.eq('user_id', userId)
      } else if (session_token) {
        query = query.eq('session_token', session_token)
      }
      
      const { data: auditRun } = await query.maybeSingle()
      
      if (auditRun?.issues_json && typeof auditRun.issues_json === 'object' && 'issues' in auditRun.issues_json) {
        responseIssues = (auditRun.issues_json as any).issues || result.issues || []
      }
    }

    // Get usage info for response (only for authenticated users)
    let usage = null
    if (isAuthenticated && userId && runId) {
      try {
        const { data: auditRun } = await supabaseAdmin
          .from('brand_audit_runs')
          .select('domain')
          .eq('id', runId)
          .eq('user_id', userId)
          .maybeSingle()
        
        if (auditRun?.domain) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('plan')
            .eq('user_id', userId)
            .maybeSingle()
          const plan = profile?.plan || 'free'
          usage = await getAuditUsage(userId, auditRun.domain, plan)
        }
      } catch (error) {
        console.error('[Poll] Failed to get usage info:', error)
        // Don't fail the request - usage info is optional
      }
    }

    // Return completed results (with filtered issues)
    return NextResponse.json({
      status: 'completed',
      runId,
      issues: responseIssues,
      totalIssues: responseIssues.length,
      usage, // Include usage info
      meta: {
        pagesScanned: result.pagesScanned,
        auditedUrls: result.auditedUrls || [],
        tier: result.tier,
      },
    })
  } catch (e) {
    const error = e instanceof Error ? e : new Error('Unknown error')
    console.error('[Poll] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

