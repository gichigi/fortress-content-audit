// Global middleware for Supabase auth session management and route protection
// This refreshes auth tokens and protects routes that require authentication

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase-middleware'
import Logger from '@/lib/logger'

export async function middleware(request: NextRequest) {
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


