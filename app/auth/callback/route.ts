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
  let next = searchParams.get('next') || '/dashboard'
  // Ensure next is a relative path for security
  if (!next.startsWith('/')) {
    next = '/dashboard'
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
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
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
    console.error('[Auth Callback] Code exchange error:', error?.message)
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
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
    console.error('[Auth Callback] OTP verification error:', error?.message)
  }

  // No valid auth params found - log what we received
  if (!code && !token_hash) {
    console.error('[Auth Callback] No code or token_hash provided. Received params:', 
      Object.fromEntries(searchParams.entries()))
  }

  // Redirect to error page on failure
  return NextResponse.redirect(`${origin}/sign-up?error=auth_failed`)
}

