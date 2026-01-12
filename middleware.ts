// Global middleware for Supabase auth session management and route protection
// This refreshes auth tokens and protects routes that require authentication

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase-middleware'
import Logger from '@/lib/logger'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // #region agent log
  // DEBUG: Log middleware invocation for all requests (hypothesis E - rewrite conflict)
  if (pathname.startsWith('/api/audit') || pathname.startsWith('/ingest')) {
    console.log(`[DEBUG-E] Middleware hit: ${pathname}`)
    fetch('http://127.0.0.1:7242/ingest/46d3112f-6e93-4e4c-a7bb-bc54c7690dac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:12',message:'Middleware invoked',data:{pathname,method:request.method},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  }
  // #endregion

  try {
    return await updateSession(request)
  } catch (error) {
    // Log middleware error for debugging
    const err = error instanceof Error ? error : new Error('Unknown middleware error')
    Logger.error('[Middleware] Session update failed', err, {
      pathname: request.nextUrl.pathname,
      method: request.method,
    })
    
    // Fail open: allow request to proceed without auth checks
    // Route handlers will handle auth requirements
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, fonts, etc.)
     * - /api/webhook (Stripe webhooks - no auth needed, middleware can cause issues)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
}


