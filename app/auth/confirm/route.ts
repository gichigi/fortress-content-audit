// Auth confirm route handler
// Handles PKCE flow token hash verification from email links
// This is the recommended pattern for Next.js with Supabase SSR

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  
  // PKCE flow params from email template
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  
  // Get redirect destination
  let next = searchParams.get('next') || '/dashboard'
  if (!next.startsWith('/')) {
    next = '/dashboard'
  }

  console.log('[Auth Confirm] Received:', { token_hash: !!token_hash, type, next })

  if (token_hash && type) {
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

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error && data.session) {
      console.log('[Auth Confirm] OTP verified successfully, user:', data.session.user.email)
      
      // Handle forwarded host for production
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

    console.error('[Auth Confirm] OTP verification failed:', error?.message)
  } else {
    console.error('[Auth Confirm] Missing token_hash or type')
  }

  // Redirect to error page
  return NextResponse.redirect(`${origin}/sign-up?error=auth_failed`)
}


