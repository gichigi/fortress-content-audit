import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import BlogContent from '@/components/blog/BlogContent'
import ShareButton from '@/components/blog/ShareButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, Home, BookOpen, ArrowRight } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import PostActions from './components/PostActions'

interface BlogPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  category: string
  featured_image?: string
  author_name: string
  author_image?: string
  published_at: string | null
  updated_at: string
  reading_time: number
  word_count: number
  keywords: string[]
  is_published: boolean
}

async function getBlogPost(slug: string, allowUnpublished: boolean = false): Promise<BlogPost | null> {
  try {
    // Import supabase client directly for server-side rendering
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Build query - conditionally filter by is_published
    let query = supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
    
    // Only filter for published posts if not allowing unpublished
    if (!allowUnpublished) {
      query = query.eq('is_published', true)
    }
    
    const { data: post, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null
      }
      console.error('Error fetching blog post:', error)
      return null
    }

    return post
  } catch (error) {
    console.error('Error fetching blog post:', error)
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const resolvedParams = await params
  
  // Check if user is admin to allow fetching unpublished posts for metadata
  const isAdmin = await isAdminAuthenticated()
  const post = await getBlogPost(resolvedParams.slug, isAdmin)
  
  if (!post) {
    return {
      title: 'Post Not Found | Fortress',
      description: 'The requested blog post could not be found.',
    }
  }

  // Add draft indicator to title if unpublished
  const titlePrefix = !post.is_published ? '[Draft] ' : ''

  return {
    title: `${titlePrefix}${post.title} | Fortress`,
    description: post.excerpt,
    keywords: post.keywords,
    authors: [{ name: post.author_name }],
    alternates: {
      canonical: `https://aistyleguide.com/blog/${post.slug}`,
    },
    openGraph: {
      title: `${titlePrefix}${post.title}`,
      description: post.excerpt,
      url: `https://aistyleguide.com/blog/${post.slug}`,
      siteName: 'AI Style Guide',
      type: 'article',
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
      images: [
        {
          url: post.featured_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=630&fit=crop&auto=format',
          width: 1200,
          height: 630,
          alt: post.title,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${titlePrefix}${post.title}`,
      description: post.excerpt,
      images: [post.featured_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=630&fit=crop&auto=format'],
    },
  }
}

// Schema.org structured data component - optimized for SEO
// Only include schema for published posts
function BlogSchema({ post }: { post: BlogPost }) {
  // Skip schema for unpublished posts (not for SEO)
  if (!post.is_published) {
    return null
  }

  // Remove the first heading from content for articleBody (title is already in headline)
  const articleBody = post.content.replace(/^#\s+.*$/m, '');
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    name: post.title, // duplicate of headline for better search compatibility
    headline: post.title,
    description: post.excerpt,
    articleBody: articleBody,
    datePublished: post.published_at || post.updated_at,
    dateModified: post.updated_at,
    inLanguage: 'en-US',
    genre: post.category,
    isPartOf: {
      '@type': 'Blog',
      name: 'AI Style Guide Blog',
      url: 'https://aistyleguide.com/blog'
    },
    author: {
      '@type': 'Person',
      name: post.author_name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AI Style Guide',
      logo: {
        '@type': 'ImageObject',
        url: 'https://aistyleguide.com/aistyleguide-logo.png',
      },
    },
    mainEntityOfPage: `https://aistyleguide.com/blog/${post.slug}`,
    url: `https://aistyleguide.com/blog/${post.slug}`,
    keywords: post.keywords.join(', '),
    wordCount: post.word_count,
    articleSection: post.category,
    image: {
      '@type': 'ImageObject',
      url: post.featured_image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=630&fit=crop&auto=format',
      width: 1200,
      height: 630,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// Breadcrumb schema for better navigation context
function BreadcrumbSchema({ slug, title }: { slug: string; title: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Blog',
        item: 'https://aistyleguide.com/blog'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title,
        item: `https://aistyleguide.com/blog/${slug}`
      }
    ]
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = await params
  
  // Check if user is authenticated as admin to allow viewing unpublished posts
  const isAdmin = await isAdminAuthenticated()
  const post = await getBlogPost(resolvedParams.slug, isAdmin)

  if (!post) {
    notFound()
  }

  // If post is unpublished and user is not admin, don't show it
  if (!post.is_published && !isAdmin) {
    notFound()
  }

  // Date formatting and update detection logic
  // This template displays dates under the author name:
  // - Shows published date if post hasn't been updated
  // - Shows "Updated on: [date]" if post has been updated (more than 1 minute difference)
  // - For unpublished posts, use updated_at as fallback
  const publishedDateObj = post.published_at ? new Date(post.published_at) : new Date(post.updated_at)
  const updatedDateObj = new Date(post.updated_at)
  
  const publishedDate = publishedDateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const updatedDate = updatedDateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Check if post has been updated (updated_at is significantly different from published_at)
  // For unpublished posts, always show updated date
  const hasBeenUpdated = post.published_at 
    ? updatedDateObj.getTime() - publishedDateObj.getTime() > 60000 // More than 1 minute difference
    : true // Unpublished posts always show as updated

  return (
    <>
      <BlogSchema post={post} />
      <BreadcrumbSchema slug={post.slug} title={post.title} />
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          {/* Navigation */}
          <nav className="mb-8 max-w-[47.6rem] mx-auto">
            <div className="flex items-center gap-3 text-sm">
              <Link 
                href="/" 
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors py-1 px-1 -mx-1 min-h-[44px] min-w-[44px] touch-manipulation"
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
              <span className="text-muted-foreground">/</span>
              <Link 
                href="/blog" 
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors py-1 px-1 -mx-1 min-h-[44px] min-w-[44px] touch-manipulation"
              >
                <BookOpen className="h-4 w-4" />
                <span>Blog</span>
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium truncate">{post.title}</span>
            </div>
          </nav>

          <article className="max-w-[47.6rem] mx-auto">
            {/* Article Header */}
            <header className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">{post.category}</Badge>
                {!post.is_published && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Draft
                  </Badge>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-sm text-muted-foreground">{post.reading_time} min read</span>
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                {post.title}
              </h1>

              <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
                {post.excerpt}
              </p>

              <div className="flex items-center justify-between py-4 border-y">
                <div className="flex items-center gap-3">
                  <Link 
                    href="https://x.com/tahigichigi" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="w-10 h-10">
                      {post.author_image ? (
                        <AvatarImage src={post.author_image} alt={post.author_name} />
                      ) : null}
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {post.author_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div>
                    <Link 
                      href="https://x.com/tahigichigi" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {post.author_name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {hasBeenUpdated ? (
                        <>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Updated on: {updatedDate}
                        </>
                      ) : (
                        <>
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {publishedDate}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {post.is_published && (
                  <ShareButton 
                    url={`https://aistyleguide.com/blog/${post.slug}`}
                    title={post.title}
                  />
                )}
              </div>

              {/* Admin actions for unpublished posts */}
              {!post.is_published && isAdmin && (
                <PostActions slug={post.slug} isPublished={post.is_published} />
              )}
            </header>

            {/* Featured Image */}
            {post.featured_image && (
              <div className="mb-8 relative w-full aspect-[2/1]">
                <Image
                  src={post.featured_image}
                  alt={post.title}
                  fill
                  quality={90}
                  sizes="(min-width: 1280px) 60vw, (min-width: 768px) 80vw, 100vw"
                  className="object-cover rounded-lg shadow-lg"
                  priority
                />
              </div>
            )}

            {/* Article Content */}
            <BlogContent>
              {post.content.replace(/^#\s+.*$/m, '')}
            </BlogContent>

            {/* CTA Section */}
            <section className="my-12 pt-8 border-t">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">Download your free preview style guide</h2>
                  <p className="text-muted-foreground">
                    Generate a professional brand voice style guide with tailored examples and rules
                  </p>
                </div>
                <Button asChild size="lg" className="text-lg font-bold bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-orange-700 hover:to-red-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200">
                  <Link href="/">
                    Free Style Guide
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </section>

            {/* Article Footer */}
            <footer className="mt-12 pt-8 border-t">
              <div className="flex flex-wrap gap-2 mb-6">
                {post.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {post.is_published ? (
                    <>
                      <p>Published on {publishedDate}</p>
                      {publishedDate !== updatedDate && (
                        <p>Last updated on {updatedDate}</p>
                      )}
                    </>
                  ) : (
                    <p>Created on {updatedDate} (Draft)</p>
                  )}
                </div>

                <Button asChild>
                  <Link href="/blog">
                    Read More Articles
                  </Link>
                </Button>
              </div>
            </footer>
          </article>
        </main>
      </div>
    </>
  )
}
