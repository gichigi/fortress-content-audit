import { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import BlogCard from '@/components/blog/BlogCard'
import Pagination from '@/components/blog/Pagination'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Blog | AI Style Guide - Brand Voice & Content Strategy Insights',
  description: 'Discover expert insights on brand voice, content strategy, and marketing best practices. Learn how to create consistent, converting content for your brand.',
  keywords: 'brand voice, content strategy, marketing blog, brand consistency, content creation, AI style guide',
  openGraph: {
    title: 'Blog | Fortress - Brand Voice & Content Strategy Insights',
    description: 'Discover expert insights on brand voice, content strategy, and marketing best practices.',
    url: 'https://aistyleguide.com/blog',
    type: 'website',
  },
}

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  category: string
  featured_image?: string
  author_name: string
  published_at: string
  reading_time: number
  keywords: string[]
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

async function getBlogPosts(page: number = 1, category?: string): Promise<{ posts: BlogPost[], pagination: PaginationInfo }> {
  try {
    // Import supabase client directly for server-side rendering
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const limit = 10
    const offset = (page - 1) * limit

    let query = supabase
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .eq('is_published', true)
      .order('published_at', { ascending: false })
    
    // Filter by category if provided
    if (category && category.trim() !== '') {
      query = query.eq('category', category)
    }
    
    const { data: posts, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching blog posts:', error)
      return {
        posts: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      }
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return {
      posts: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  } catch (error) {
    console.error('Error fetching blog posts:', error)
      return {
        posts: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      }
  }
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const currentPage = parseInt(resolvedSearchParams.page || '1')
  const selectedCategory = resolvedSearchParams.category
  const { posts, pagination } = await getBlogPosts(currentPage, selectedCategory)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Brand Voice & Content Strategy
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover expert insights on creating consistent, converting content that builds stronger brand connections.
          </p>
        </div>

        {/* Blog Posts Grid */}
        {posts.length > 0 ? (
          <>
            <div className="max-w-[42.5rem] mx-auto mb-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {posts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
              basePath={selectedCategory ? `/blog?category=${encodeURIComponent(selectedCategory)}` : '/blog'}
            />
          </>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">No blog posts found</h2>
            <p className="text-muted-foreground">
              Check back soon for new content about brand voice and content strategy.
            </p>
          </div>
        )}

        {/* Categories Section */}
        <div className="mt-16 pt-12 border-t">
          <h2 className="text-2xl font-semibold mb-6 text-center">Explore Topics</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/blog"
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                !selectedCategory
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-primary hover:text-primary-foreground"
              )}
            >
              All
            </Link>
            {['Tone Of Voice Fundamentals', 'Brand Voice Foundations', 'Guidelines & Templates', 'Examples & Case Studies', 'Channel & Execution'].map((category) => {
              const isActive = selectedCategory === category
              return (
                <Link
                  key={category}
                  href={`/blog?category=${encodeURIComponent(category)}`}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  {category}
                </Link>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
