// Poll background audit status (for paid/enterprise tiers)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pollAuditStatus, AuditTier } from '@/lib/audit'
import { generateIssueSignature, generateInstanceSignature } from '@/lib/issue-signature'
import { AuditIssueGroup } from '@/lib/audit-table-adapter'
import { incrementAuditUsage, getAuditUsage } from '@/lib/audit-rate-limit'

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
          issuesFound: result.groups?.length || 0,
        },
      })
    }

    // Audit completed - update the database record if we have a runId
    if (runId) {
      // Get audit domain for filtering ignored issues
      const { data: auditRun } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('domain')
        .eq('id', runId)
        .eq('user_id', userId)
        .maybeSingle()

      // Filter out ignored issues for authenticated users
      let filteredGroups = result.groups || []
      let filteredInstances = result.instances || []
      
      if (auditRun?.domain) {
        // Query ignored issue signatures for this user/domain
        const { data: ignoredStates } = await supabaseAdmin
          .from('audit_issue_states')
          .select('signature')
          .eq('user_id', userId)
          .eq('domain', auditRun.domain)
          .eq('state', 'ignored')

        if (ignoredStates && ignoredStates.length > 0) {
          const ignoredSignatures = new Set(ignoredStates.map((s) => s.signature))
          
          // Filter out groups whose signatures match ignored states (legacy)
          filteredGroups = result.groups.filter((group: AuditIssueGroup) => {
            const signature = generateIssueSignature(group)
            return !ignoredSignatures.has(signature)
          })

          // Filter out instances whose signatures match ignored states
          filteredInstances = (result.instances || []).filter((instance) => {
            return !ignoredSignatures.has(instance.signature)
          })

          console.log(`[Poll] Filtered out ${result.groups.length - filteredGroups.length} ignored issue groups, ${(result.instances?.length || 0) - filteredInstances.length} ignored instances`)
        }
      }

      const issuesJson = {
        groups: filteredGroups,
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
        
        // Save instances to audit_issues table
        if (filteredInstances.length > 0) {
          try {
            const instancesToInsert = filteredInstances.map((instance) => ({
              audit_id: runId,
              category: instance.category,
              severity: instance.severity,
              title: instance.title,
              url: instance.url,
              snippet: instance.snippet,
              impact: instance.impact || null,
              fix: instance.fix || null,
              signature: instance.signature,
            }))

            const { error: instancesErr } = await (supabaseAdmin as any)
              .from('audit_issues')
              .insert(instancesToInsert)

            if (instancesErr) {
              console.error('[Poll] Failed to save instances:', instancesErr)
              // Don't fail the request - instances are non-critical for backward compatibility
            } else {
              console.log(`[Poll] Saved ${instancesToInsert.length} instances to audit_issues table`)
            }
          } catch (error) {
            console.error('[Poll] Error saving instances:', error)
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
      }
    }

    // Get filtered groups (or use result.groups if filtering wasn't done)
    // Note: Filtering happens above when updating database, but we need to filter here too for the response
    let responseGroups = result.groups || []
    if (runId) {
      const { data: auditRun } = await supabaseAdmin
        .from('brand_audit_runs')
        .select('domain, issues_json')
        .eq('id', runId)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (auditRun?.issues_json && typeof auditRun.issues_json === 'object' && 'groups' in auditRun.issues_json) {
        responseGroups = (auditRun.issues_json as any).groups || result.groups || []
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

    // Return completed results (with filtered groups)
    return NextResponse.json({
      status: 'completed',
      runId,
      groups: responseGroups,
      totalIssues: responseGroups.length,
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

