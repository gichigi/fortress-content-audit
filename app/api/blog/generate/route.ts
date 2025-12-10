import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateWithOpenAI } from '@/lib/openai'
import { cookies } from 'next/headers'
import fs from 'fs'
import path from 'path'
import { BLOG_SYSTEM_PROMPT, getBlogOutlinePrompt, getBlogArticlePromptFromOutline } from '@/lib/blog-prompts'
// import { searchBrief } from '@/lib/firecrawl' // Disabled - Firecrawl credits exhausted
import OpenAI from 'openai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Available categories for blog posts
const AVAILABLE_CATEGORIES = [
  'Tone Of Voice Fundamentals',
  'Brand Voice Foundations',
  'Guidelines & Templates',
  'Examples & Case Studies',
  'Channel & Execution'
]

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

async function generateCategory(topic: string, keywords: string[]): Promise<string> {
  const keywordsText = keywords.length > 0 ? keywords.join(', ') : 'none provided'
  
  const prompt = `Analyze this blog topic and determine the most appropriate category from these options:
${AVAILABLE_CATEGORIES.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

Topic: ${topic}
Keywords: ${keywordsText}

Return ONLY the category name that best fits this topic. No explanation, just the category name.`

  const result = await generateWithOpenAI(
    prompt,
    'You are a content categorization expert. Return only the category name.',
    'markdown',
    50,
    'gpt-4o-mini'
  )

  if (result.success && result.content) {
    // Clean up the category - strip markdown code blocks if present
    let category = result.content.trim()
    category = category.replace(/^`+|`+$/g, '') // Remove markdown code block markers
    category = category.trim()
    
    // Validate it's one of our categories
    if (AVAILABLE_CATEGORIES.includes(category)) {
      return category
    }
  }

  // Fallback to default
  return 'Tone Of Voice Fundamentals'
}

// Function to read blog images directory and return sorted filenames
async function getBlogImages(): Promise<string[]> {
  try {
    const blogImagesPath = path.join(process.cwd(), 'public', 'blog-images')
    
    // Check if directory exists
    if (!fs.existsSync(blogImagesPath)) {
      console.error('Blog images directory not found:', blogImagesPath)
      return []
    }
    
    // Read directory contents
    const files = await fs.promises.readdir(blogImagesPath)
    
    // Filter for image files and sort alphabetically
    const imageFiles = files
      .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
      .sort()
    
    console.log(`Found ${imageFiles.length} blog images:`, imageFiles.slice(0, 3), '...')
    return imageFiles
  } catch (error) {
    console.error('Error reading blog images directory:', error)
    return []
  }
}

/**
 * Parse content-batch-plan.md to extract link instructions for a topic
 */
async function getLinkInstructions(topicTitle: string, supabase: any): Promise<{ internal: Array<{ title: string; slug: string }>; external: Array<{ title: string; url: string }> } | null> {
  const contentPlanPath = path.join(process.cwd(), 'scripts', 'content-batch-plan.md')
  
  try {
    if (!fs.existsSync(contentPlanPath)) {
      return null
    }

    const contentPlan = fs.readFileSync(contentPlanPath, 'utf-8')
    const lines = contentPlan.split('\n')
    
    // Find the row matching this topic title
    let linkPlan: string | null = null
    for (const line of lines) {
      if (line.includes('|') && line.includes(topicTitle)) {
        const columns = line.split('|').map(col => col.trim())
        if (columns.length >= 6) {
          linkPlan = columns[5] // Internal Link Plan is the 6th column
          break
        }
      }
    }

    if (!linkPlan) {
      return null
    }

    // Parse links from the plan
    const internalLinks: Array<{ title: string; slug: string }> = []
    const linkPatterns = [
      { prefix: 'Up:' },
      { prefix: 'Cross:' },
      { prefix: 'Resource:' }
    ]

    for (const pattern of linkPatterns) {
      const regex = new RegExp(`${pattern.prefix}\\s*([^<]+)`, 'gi')
      let match
      while ((match = regex.exec(linkPlan)) !== null) {
        const titles = match[1].split(',').map(t => t.trim()).filter(t => t)
        for (const title of titles) {
          const slug = slugify(title)
          const { data } = await supabase
            .from('blog_posts')
            .select('slug, title')
            .eq('slug', slug)
            .maybeSingle()
          
          if (data) {
            internalLinks.push({ title: data.title, slug: data.slug })
          }
        }
      }
    }

    return {
      internal: internalLinks,
      external: []
    }
  } catch (error) {
    console.warn('Error parsing content plan:', error)
    return null
  }
}

// Function to select image based on post count (cycling through images)
async function selectBlogImage(supabase: any): Promise<string | null> {
  try {
    // Get available images
    const images = await getBlogImages()
    if (images.length === 0) {
      console.log('No blog images available')
      return null
    }
    
    // Count existing blog posts to determine cycle index
    const { count, error } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.error('Error counting blog posts:', error)
      // Fallback to first image if count fails
      return `/blog-images/${images[0]}`
    }
    
    // Calculate image index using modulo to cycle through images
    const imageIndex = (count || 0) % images.length
    const selectedImage = `/blog-images/${images[imageIndex]}`
    
    console.log(`Selected image ${imageIndex + 1}/${images.length}: ${selectedImage}`)
    return selectedImage
  } catch (error) {
    console.error('Error selecting blog image:', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authentication - check session cookie
    const cookieStore = await cookies()
    const session = cookieStore.get('admin-blog-session')
    
    if (!session || session.value !== 'authenticated') {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 })
    }

    // Parse and validate input
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const topic: string = body?.topic
    const keywords: string[] = Array.isArray(body?.keywords) ? body.keywords : []
    const categoryOverride: string | undefined = body?.category
    const publish: boolean = body?.publish !== false

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400 })
    }

    // Generate category if not provided
    let category = categoryOverride
    if (!category) {
      category = await generateCategory(topic, keywords)
    }

    // Validate category is in allowed list
    if (!AVAILABLE_CATEGORIES.includes(category)) {
      category = 'Tone Of Voice Fundamentals' // Fallback
    }

    // Use shared prompts from lib/blog-prompts.js
    const systemPrompt = BLOG_SYSTEM_PROMPT

    // Firecrawl disabled - skip research notes
    // TODO: Re-enable Firecrawl once credits are available
    let researchNotes = null
    // try {
    //   const searchResult = await searchBrief(topic, keywords, 8)
    //   if (searchResult && searchResult.success) {
    //     researchNotes = {
    //       summary: searchResult.summary,
    //       urls: searchResult.urls,
    //       markdown: searchResult.markdown
    //     }
    //     console.log(`Found ${searchResult.urls.length} recent sources for briefing`)
    //   }
    // } catch (searchError) {
    //   console.warn('Search briefing failed, continuing without:', searchError instanceof Error ? searchError.message : 'Unknown error')
    // }

    // Step 1: Generate outline using gpt-4o
    const outlinePrompt = getBlogOutlinePrompt(topic, keywords, researchNotes || undefined)
    const outlineResult = await generateWithOpenAI(
      outlinePrompt,
      systemPrompt,
      'json',
      2000,
      'gpt-4o'
    )

    if (!outlineResult.success || !outlineResult.content) {
      console.error('Outline generation failed:', outlineResult.error)
      return NextResponse.json(
        { error: outlineResult.error || 'Outline generation failed' },
        { status: 502 }
      )
    }

    // Parse outline
    let outline
    try {
      outline = JSON.parse(outlineResult.content)
    } catch (parseError) {
      console.error('Failed to parse outline JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON response from outline generation' },
        { status: 502 }
      )
    }

    // Get link instructions from content plan
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    let linkInstructions = await getLinkInstructions(topic, supabase)
    
    // Add external links from Firecrawl research notes
    if (researchNotes && researchNotes.urls && researchNotes.urls.length > 0) {
      if (!linkInstructions) {
        linkInstructions = { internal: [], external: [] }
      }
      linkInstructions.external = researchNotes.urls.map(url => ({
        title: url.split('/').pop()?.replace(/-/g, ' ') || 'Source',
        url: url
      }))
    }

    // Step 2: Generate article from outline using gpt-4o-mini with temperature 0.8
    // Outline now contains research_excerpts, so we don't need to pass researchNotes separately
    const articlePrompt = getBlogArticlePromptFromOutline(outline, keywords, linkInstructions || undefined)
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    
    const articleResponse = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: articlePrompt }
      ],
      temperature: 0.8,
      max_tokens: 4096
    })

    const rawResponse = articleResponse.choices[0]?.message?.content
    if (!rawResponse) {
      return NextResponse.json(
        { error: 'Empty response from article generation' },
        { status: 502 }
      )
    }

    // Clean response (remove markdown code blocks)
    let cleanedResponse = rawResponse.trim()
    cleanedResponse = cleanedResponse.replace(/```(json|markdown)\n?/g, '').replace(/```\n?/g, '')

    // For JSON, try to extract valid JSON
    const jsonStart = Math.min(
      cleanedResponse.indexOf('[') >= 0 ? cleanedResponse.indexOf('[') : Infinity,
      cleanedResponse.indexOf('{') >= 0 ? cleanedResponse.indexOf('{') : Infinity
    )
    
    if (jsonStart < Infinity) {
      let jsonText = cleanedResponse.substring(jsonStart)
      for (let i = jsonText.length; i > 0; i--) {
        try {
          const candidate = jsonText.substring(0, i)
          JSON.parse(candidate)
          cleanedResponse = candidate
          break
        } catch (e) {
          // Continue trying shorter substrings
        }
      }
    }

    const result = {
      success: true,
      content: cleanedResponse.trim()
    }

    // Parse generated content
    let generated
    try {
      generated = JSON.parse(result.content)
    } catch (parseError) {
      console.error('Failed to parse generated JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON response from content generation' },
        { status: 502 }
      )
    }

    // Validate required fields
    const title: string = generated.title
    const content: string = generated.content
    const excerpt: string = generated.excerpt
    const kws: string[] = Array.isArray(generated.keywords) ? generated.keywords : keywords

    if (!title || !content || !excerpt) {
      return NextResponse.json(
        { error: 'Incomplete generation: missing title, content, or excerpt' },
        { status: 502 }
      )
    }

    // Generate slug and calculate metrics
    const slug = slugify(title)
    const word_count = content.split(/\s+/).length
    const reading_time = Math.ceil(word_count / 200)

    // Select featured image using cycling logic
    const featured_image = await selectBlogImage(supabase)

    // Prepare blog post data
    const blogPost = {
      title,
      slug,
      content,
      excerpt,
      keywords: kws,
      category,
      featured_image,
      author_name: 'Tahi Gichigi',
      author_image: '/logos/profile_orange_clean.png',
      word_count,
      reading_time,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null
    }

    // Insert into database
    const { data, error } = await supabase
      .from('blog_posts')
      .insert([blogPost])
      .select()
      .single()

    if (error) {
      if ((error as any).code === '23505') {
        // Unique constraint violation (duplicate slug)
        return NextResponse.json(
          { error: 'A post with this slug already exists' },
          { status: 409 }
        )
      }
      console.error('Database insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create blog post' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, post: data },
      { status: 201 }
    )
  } catch (err) {
    console.error('Generate endpoint error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

