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
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = userData.user.id

    const body = await request.json().catch(() => ({}))
    const { responseId, runId } = body || {}

    if (!responseId) {
      return NextResponse.json({ error: 'Missing responseId' }, { status: 400 })
    }

    // Retrieve tier from database if runId is provided
    let tier: AuditTier | undefined = undefined
    if (runId) {
      const { data: auditRun } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('issues_json')
        .eq('id', runId)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (auditRun?.issues_json && typeof auditRun.issues_json === 'object' && 'tier' in auditRun.issues_json) {
        const storedTier = (auditRun.issues_json as any).tier
        // Validate tier is a valid AuditTier
        if (storedTier === 'FREE' || storedTier === 'PAID' || storedTier === 'ENTERPRISE') {
          tier = storedTier as AuditTier
          console.log(`[Poll] Retrieved tier ${tier} from database for runId: ${runId}`)
        }
      }
    }

    console.log(`[Poll] Checking status for responseId: ${responseId}${tier ? ` (tier: ${tier})` : ''}`)
    const result = await pollAuditStatus(responseId, tier)

    // If still in progress, return status with progress info
    if (result.status === 'in_progress') {
      return NextResponse.json({
        status: 'in_progress',
        responseId,
        message: 'Audit is still running. Check back in a few seconds.',
        progress: {
          pagesScanned: result.pagesScanned || 0,
          issuesFound: result.issues?.length || 0,
        },
      })
    }

    // Audit completed - update the database record if we have a runId
    if (runId) {
      // Get audit domain and email status for filtering ignored issues and sending email
      const { data: auditRun } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('domain, completion_email_sent')
        .eq('id', runId)
        .eq('user_id', userId)
        .maybeSingle()

      // Note: For new audits, we don't filter by status yet - issues start as 'active'
      // Status filtering happens when fetching issues from the database
      const filteredIssues = result.issues || []

      const issuesJson = {
        issues: filteredIssues,
        auditedUrls: result.auditedUrls || [],
        tier: result.tier || tier, // Preserve tier for future lookups
      }

      const { error: updateErr } = await supabaseAdmin
        .from('brand_audit_runs')
        .update({
          pages_scanned: result.pagesScanned,
          issues_json: issuesJson,
        })
        .eq('id', runId)
        .eq('user_id', userId)

      if (updateErr) {
        console.error('[Poll] Failed to update audit run:', updateErr)
      } else {
        console.log(`[Poll] Updated audit run: ${runId}`)
        
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
        
        // Increment audit usage when audit completes (only once per audit)
        // Check if we've already incremented by checking if audit was just completed
        if (auditRun?.domain) {
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
      const { data: auditRun } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('domain, issues_json')
        .eq('id', runId)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (auditRun?.issues_json && typeof auditRun.issues_json === 'object' && 'issues' in auditRun.issues_json) {
        responseIssues = (auditRun.issues_json as any).issues || result.issues || []
      }
    }

    // Get usage info for response (only for authenticated users)
    let usage = null
    if (userId && runId) {
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

