// Middleware utility for Supabase session management
// Handles token refresh and route protection

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/sign-up',
  '/start',
  '/demo',
  '/blog',
  '/brand-details',
  '/preview',
  '/payment',
  '/api/scrape',
  '/api/preview',
  '/api/generate-styleguide',
  '/api/analyze-brand',
  '/api/clarifying-questions',
  '/api/ab-comparison',
  '/api/ab-comparisons',
  '/api/voice-profile',
  '/api/onboarding',
  '/api/webhook',
  '/api/checkout',
  '/api/email-capture',
  '/api/process-abandoned-emails',
  '/api/audit', // Allow unauthenticated audit requests for preview
  '/auth',
]

// Routes that authenticated users should be redirected away from
// Note: /auth/update-password is NOT included - users need recovery session to update password
const AUTH_ROUTES_FOR_UNAUTHENTICATED = ['/sign-up', '/auth/reset-password']

// Check if path matches any public route (including nested paths)
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/') return pathname === '/'
    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Redirect authenticated users away from auth pages (except update-password which needs recovery session)
  if (user && AUTH_ROUTES_FOR_UNAUTHENTICATED.some(route => pathname.startsWith(route))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirectResponse = NextResponse.redirect(url)
    // Preserve cookies from supabaseResponse to maintain session
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Protected routes: redirect unauthenticated users to sign-up
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-up'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it
  // 2. Copy over the cookies
  // 3. Change the myNewResponse object to fit your needs
  // 4. Return it
  // If this is not done, you may cause the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}

