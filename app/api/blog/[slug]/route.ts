import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper to check admin authentication
async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin-blog-session')
    return session?.value === 'authenticated'
  } catch {
    return false
  }
}

// GET /api/blog/[slug] - Fetch individual blog post by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params
    const { slug } = resolvedParams

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Check if admin - allow fetching unpublished posts
    const isAdmin = await isAdminAuthenticated()
    
    let query = supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
    
    if (!isAdmin) {
      query = query.eq('is_published', true)
    }
    
    const { data: post, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
      }
      console.error('Error fetching blog post:', error)
      return NextResponse.json({ error: 'Failed to fetch blog post' }, { status: 500 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error in blog slug API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/blog/[slug] - Update blog post (requires admin auth)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Check admin authentication
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const resolvedParams = await params
    const { slug } = resolvedParams
    const body = await request.json()
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Calculate word count and reading time if content is updated
    if (body.content) {
      const wordCount = body.content.split(/\s+/).length
      body.word_count = wordCount
      body.reading_time = Math.ceil(wordCount / 200)
    }

    // Update published_at if publishing for the first time
    if (body.is_published && !body.published_at) {
      body.published_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .update(body)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
      }
      console.error('Error updating blog post:', error)
      return NextResponse.json({ error: 'Failed to update blog post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: data })
  } catch (error) {
    console.error('Error in blog PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/blog/[slug] - Publish/unpublish blog post (requires admin auth)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Check admin authentication
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const resolvedParams = await params
    const { slug } = resolvedParams
    const body = await request.json()
    const action = body.action // 'publish' or 'unpublish'
    
    if (!action || !['publish', 'unpublish'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "publish" or "unpublish"' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const updateData: any = {
      is_published: action === 'publish',
      updated_at: new Date().toISOString()
    }

    // Set published_at if publishing for the first time
    if (action === 'publish') {
      // Check if post already has published_at
      const { data: existingPost } = await supabase
        .from('blog_posts')
        .select('published_at')
        .eq('slug', slug)
        .single()

      if (!existingPost?.published_at) {
        updateData.published_at = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
      }
      console.error('Error publishing blog post:', error)
      return NextResponse.json({ error: 'Failed to publish blog post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: data })
  } catch (error) {
    console.error('Error in blog PATCH API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/blog/[slug] - Delete blog post (requires admin auth)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Check admin authentication
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    const resolvedParams = await params
    const { slug } = resolvedParams

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('slug', slug)

    if (error) {
      console.error('Error deleting blog post:', error)
      return NextResponse.json({ error: 'Failed to delete blog post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Blog post deleted' })
  } catch (error) {
    console.error('Error in blog DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}







