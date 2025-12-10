import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/blog - Fetch paginated blog posts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const category = searchParams.get('category')
    const published = searchParams.get('published') !== 'false' // Default to published only
    
    const offset = (page - 1) * limit

    let query = supabase
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (published) {
      query = query.eq('is_published', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: posts, error, count } = await query

    if (error) {
      console.error('Error fetching blog posts:', error)
      return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Error in blog API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/blog - Create new blog post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      title, 
      slug, 
      content, 
      excerpt, 
      keywords = [], 
      category = 'Tone Of Voice Fundamentals',
      featured_image,
      author_name = 'Tahi Gichigi',
      author_image,
      is_published = false 
    } = body

    // Validate required fields
    if (!title || !slug || !content || !excerpt) {
      return NextResponse.json(
        { error: 'Missing required fields: title, slug, content, excerpt' },
        { status: 400 }
      )
    }

    // Calculate word count and reading time
    const wordCount = content.split(/\s+/).length
    const readingTime = Math.ceil(wordCount / 200) // Average reading speed: 200 words/minute

    const blogPost = {
      title,
      slug,
      content,
      excerpt,
      keywords,
      category,
      featured_image,
      author_name,
      author_image,
      word_count: wordCount,
      reading_time: readingTime,
      is_published,
      published_at: is_published ? new Date().toISOString() : null
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .insert([blogPost])
      .select()
      .single()

    if (error) {
      console.error('Error creating blog post:', error)
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A post with this slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: data }, { status: 201 })
  } catch (error) {
    console.error('Error in blog POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}






