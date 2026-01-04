// DEPRECATED: Stream audit progress via Server-Sent Events (SSE)
// This endpoint is deprecated as of the GPT-5.1 unified audit refactor.
// All audits now complete synchronously - no background execution or streaming needed.
// Kept temporarily for legacy audits that may still be in progress.
// TODO: Remove this endpoint after transition period (30 days from refactor date).
//
// Stream audit progress via Server-Sent Events (SSE)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pollAuditStatus, AuditTier } from '@/lib/audit'

function getBearer(req: Request) {
  const a = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!a?.toLowerCase().startsWith('bearer ')) return null
  return a.split(' ')[1]
}

// Helper to send SSE event
function sendSSE(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(message))
}

export async function GET(request: Request) {
  // Log deprecation warning
  console.warn('[Stream] DEPRECATED: Stream endpoint called. All audits now complete synchronously.')
  
  const { searchParams } = new URL(request.url)
  const responseId = searchParams.get('responseId')
  const runId = searchParams.get('runId')
  const session_token = searchParams.get('session_token')

  if (!responseId) {
    return NextResponse.json({ error: 'Missing responseId' }, { status: 400 })
  }

  const token = getBearer(request)
  let userId: string | null = null
  let isAuthenticated = false

  if (token) {
    const { data: userData } = await supabaseAdmin.auth.getUser(token)
    if (userData?.user?.id) {
      userId = userData.user.id
      isAuthenticated = true
    }
  }

  // Retrieve tier from database if runId is provided
  let tier: AuditTier | undefined = undefined
  let queuedCount = 0
  if (runId) {
    let query = supabaseAdmin
      .from('brand_audit_runs')
      .select('issues_json, user_id, session_token')
      .eq('id', runId)
    
    if (isAuthenticated && userId) {
      query = query.eq('user_id', userId)
    } else if (session_token) {
      query = query.eq('session_token', session_token)
    }
    
    const { data: auditRun } = await query.maybeSingle()
    
    if (auditRun?.issues_json && typeof auditRun.issues_json === 'object') {
      const issuesJson = auditRun.issues_json as any
      if (issuesJson.tier === 'FREE' || issuesJson.tier === 'PAID' || issuesJson.tier === 'ENTERPRISE') {
        tier = issuesJson.tier as AuditTier
      }
      if (typeof issuesJson.queued_count === 'number') {
        queuedCount = issuesJson.queued_count
      }
    }
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const QUEUED_THRESHOLDS = {
        FREE: 30,
        PAID: 60,
        ENTERPRISE: 120,
      }

      let lastPagesScanned = 0
      let lastIssuesCount = 0
      let lastAuditedUrls: string[] = []
      let lastReasoningSummaries: string[] = []
      let pollCount = 0
      const maxPolls = 1000 // Safety limit
      const pollInterval = 3000 // Poll every 3 seconds

      const poll = async () => {
        try {
          pollCount++
          if (pollCount > maxPolls) {
            sendSSE(controller, 'error', { message: 'Max polls exceeded' })
            controller.close()
            return
          }

          const result = await pollAuditStatus(responseId, tier)

          // Handle queued timeout
          if (result.status === 'queued' || result.status === 'in_progress') {
            const isQueued = result.status === 'queued' || result.rawStatus === 'queued'
            const newQueuedCount = isQueued ? queuedCount + 1 : 0
            queuedCount = newQueuedCount

            const threshold = tier ? QUEUED_THRESHOLDS[tier] : QUEUED_THRESHOLDS.PAID
            if (isQueued && newQueuedCount >= threshold) {
              sendSSE(controller, 'error', { 
                error: 'queued_timeout',
                message: 'Audit was queued for too long. Please try again.' 
              })
              controller.close()
              return
            }
          }

          // Extract progress updates
          const pagesScanned = result.pagesScanned || 0
          const auditedUrls = result.auditedUrls || []
          const issuesCount = result.issues?.length || 0
          const reasoningSummaries = result.reasoningSummaries || []

          // Send progress event if there are changes
          if (
            pagesScanned !== lastPagesScanned ||
            issuesCount !== lastIssuesCount ||
            JSON.stringify(auditedUrls) !== JSON.stringify(lastAuditedUrls) ||
            JSON.stringify(reasoningSummaries) !== JSON.stringify(lastReasoningSummaries)
          ) {
            sendSSE(controller, 'progress', {
              pagesScanned,
              issuesFound: issuesCount,
              auditedUrls,
              status: result.status,
              reasoningSummaries,
            })

            lastPagesScanned = pagesScanned
            lastIssuesCount = issuesCount
            lastAuditedUrls = auditedUrls
            lastReasoningSummaries = reasoningSummaries
          }

          // Check if completed
          if (result.status === 'completed') {
            sendSSE(controller, 'complete', {
              pagesScanned: result.pagesScanned,
              issuesFound: result.issues?.length || 0,
              auditedUrls: result.auditedUrls || [],
              totalIssues: result.issues?.length || 0,
            })
            controller.close()
            return
          }

          // Check if failed
          if (result.status === 'failed') {
            sendSSE(controller, 'error', { 
              error: 'audit_failed',
              message: 'Audit failed. Please try again.' 
            })
            controller.close()
            return
          }

          // Schedule next poll
          setTimeout(poll, pollInterval)
        } catch (error) {
          console.error('[Stream] Poll error:', error)
          sendSSE(controller, 'error', { 
            message: error instanceof Error ? error.message : 'Polling error' 
          })
          controller.close()
        }
      }

      // Start polling
      sendSSE(controller, 'connected', { responseId, tier })
      poll()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

