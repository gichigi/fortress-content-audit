import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_BLOG_PASSWORD = process.env.ADMIN_BLOG_PASSWORD!

export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_BLOG_PASSWORD) {
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_BLOG_PASSWORD not set' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { password } = body

    if (!password || password !== ADMIN_BLOG_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Set session cookie (expires in 7 days)
    const cookieStore = await cookies()
    cookieStore.set('admin-blog-session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}

