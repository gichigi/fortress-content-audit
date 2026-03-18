// Auth callback route handler
// Handles both OAuth (code) and Magic Link (token_hash) auth flows
// Profile is auto-created via database trigger (006_add_profile_trigger.sql)

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  
  // Log all params for debugging
  console.log('[Auth Callback] URL:', requestUrl.toString())
  console.log('[Auth Callback] All params:', Object.fromEntries(searchParams.entries()))
  
  // OAuth flow uses 'code', magic link uses 'token_hash'
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  
  // Get redirect destination (default to dashboard)
  // Strict validation: only allow relative paths to prevent open redirects
  let next = searchParams.get('next') || '/dashboard'
  
  // Validate redirect URL - must be relative path, no protocol, no host
  if (!next.startsWith('/') || next.includes('://') || next.includes('//')) {
    console.warn('[Auth Callback] Invalid redirect URL detected:', next)
    next = '/dashboard'
  }
  
  // Additional security: prevent redirects to auth pages to avoid loops
  if (next.startsWith('/auth') || next.startsWith('/sign-up')) {
    console.warn('[Auth Callback] Redirect to auth page blocked:', next)
    next = '/dashboard'
  }

  const cookieStore = await cookies()
  // Track cookies set during the auth flow so we can copy them onto the redirect response.
  // NextResponse.redirect() creates a new response object — cookies set on cookieStore alone
  // are NOT automatically included, so the browser would never receive the session cookie.
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(incoming) {
          try {
            incoming.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              cookiesToSet.push({ name, value, options: options as Record<string, unknown> })
            })
          } catch {
            // Cookie setting may fail in some contexts
          }
        },
      },
    }
  )

  // Handle OAuth callback (Google, etc.) and PKCE code exchange
  if (code) {
    console.log('[Auth Callback] Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      console.log('[Auth Callback] Code exchange successful, user:', data.session.user.email)
      
      // Handle forwarded host for production deployments behind load balancers
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      let redirectUrl: string
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`
      } else {
        redirectUrl = `${origin}${next}`
      }
      
      const response = NextResponse.redirect(redirectUrl)
      // Copy session cookies onto the redirect response so the browser receives them
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      })
      return response
    }

    // Log error details for debugging (but don't expose to user)
    console.error('[Auth Callback] Code exchange error:', {
      message: error?.message,
      status: error?.status,
      code: code.substring(0, 10) + '...', // Log partial code for debugging
    })
    
    // Redirect to sign-up with error (code may be expired or invalid)
    return NextResponse.redirect(`${origin}/sign-up?error=auth_failed&reason=code_invalid`)
  }

  // Handle Magic Link callback (PKCE flow with token_hash)
  if (token_hash && type) {
    console.log('[Auth Callback] Verifying OTP with token_hash, type:', type)
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })
    
    if (!error && data.session) {
      console.log('[Auth Callback] OTP verification successful, user:', data.session.user.email)
      
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      let redirectUrl: string
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`
      } else {
        redirectUrl = `${origin}${next}`
      }
      
      const response = NextResponse.redirect(redirectUrl)
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      })
      return response
    }

    // Log error for debugging
    console.error('[Auth Callback] OTP verification error:', {
      message: error?.message,
      status: error?.status,
      type,
    })
    
    // Redirect to sign-up with error (token may be expired or invalid)
    return NextResponse.redirect(`${origin}/sign-up?error=auth_failed&reason=token_invalid`)
  }

  // No valid auth params found - log what we received for debugging
  if (!code && !token_hash) {
    console.error('[Auth Callback] No code or token_hash provided. Received params:', 
      Object.fromEntries(searchParams.entries()))
    
    // This could be a direct visit or a malformed callback
    // Redirect to sign-up with a generic error
    return NextResponse.redirect(`${origin}/sign-up?error=auth_failed&reason=missing_params`)
  }

  // Fallback: redirect to sign-up with error
  // This should rarely be reached if code paths above are correct
  console.error('[Auth Callback] Unexpected state - no valid auth flow detected')
  return NextResponse.redirect(`${origin}/sign-up?error=auth_failed`)
}

