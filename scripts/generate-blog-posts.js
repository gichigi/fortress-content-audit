#!/usr/bin/env node

/**
 * Blog Post Generation Script
 * Reads CSV topics and generates blog posts using OpenAI API
 * Usage: node scripts/generate-blog-posts.js [--dry-run] [--limit=5]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import dotenv from 'dotenv'
import { BLOG_SYSTEM_PROMPT, getBlogOutlinePrompt, getBlogArticlePromptFromOutline } from '../lib/blog-prompts.js'
import { searchBrief } from '../lib/firecrawl.js'

// Load environment variables from .env file
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
// Allow override with --csv flag, otherwise use default path
const csvArg = process.argv.find(arg => arg.startsWith('--csv='))
const DEFAULT_CSV_PATH = '/Users/tahi/Downloads/AIStyleGuide_HighLevel_Topics_and_Keywords.csv'
const TEMPLATE_CSV_PATH = path.join(__dirname, 'blog-topics-template.csv')
const CSV_PATH = csvArg ? csvArg.split('=')[1] : DEFAULT_CSV_PATH
const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '5')

// Standalone generateWithOpenAI function (matches lib/openai.ts logic)
async function generateWithOpenAI(prompt, systemPrompt, responseFormat = 'json', max_tokens = 2000, model = 'gpt-4o-mini') {
  const maxAttempts = 3
  
  // Initialize OpenAI client (lazy initialization)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: max_tokens
      })

      const rawResponse = response.choices[0]?.message?.content
      if (!rawResponse) {
        throw new Error('Empty response from OpenAI')
      }

      // Log token usage
      if (response.usage) {
        console.log('='.repeat(50))
        console.log('🔢 TOKEN USAGE SUMMARY')
        console.log('='.repeat(50))
        console.log(`Model: ${response.model}`)
        console.log(`Prompt tokens: ${response.usage.prompt_tokens}`)
        console.log(`Completion tokens: ${response.usage.completion_tokens}`)
        console.log(`Total tokens: ${response.usage.total_tokens}`)
        console.log(`Max tokens requested: ${max_tokens}`)
        console.log('='.repeat(50))
      }

      // Clean response (remove markdown code blocks)
      let cleanedResponse = rawResponse.trim()
      cleanedResponse = cleanedResponse.replace(/```(json|markdown)\n?/g, '').replace(/```\n?/g, '')

      // For JSON, try to extract valid JSON
      if (responseFormat === 'json') {
        const jsonStart = Math.min(
          cleanedResponse.indexOf('[') >= 0 ? cleanedResponse.indexOf('[') : Infinity,
          cleanedResponse.indexOf('{') >= 0 ? cleanedResponse.indexOf('{') : Infinity
        )
        
        if (jsonStart < Infinity) {
          let jsonText = cleanedResponse.substring(jsonStart)
          // Try to find valid JSON by parsing progressively smaller substrings
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
      }

      return {
        success: true,
        content: cleanedResponse.trim()
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate content'
        }
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }

  return {
    success: false,
    error: 'Unexpected error in generation'
  }
}

// Use shared prompts from lib/blog-prompts.js
const SYSTEM_PROMPT = BLOG_SYSTEM_PROMPT

/**
 * Parse CSV file
 * Expected format:
 * - Column 1: title (required)
 * - Column 2: keywords (required, comma-separated)
 * - Column 3: category (optional, defaults to Tone Of Voice Fundamentals)
 * 
 * Example:
 * title,keywords,category
 * Brand Voice Guide,brand voice,marketing,Tone Of Voice Fundamentals
 */
/**
 * Parse CSV row handling quoted fields with commas
 */
function parseCSVRow(row) {
  const values = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    
    if (char === '"') {
      // Handle escaped quotes ("")
      if (i + 1 < row.length && row[i + 1] === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim()) // Add last value
  
  return values
}

function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row')
  }
  
  const headers = parseCSVRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  
  return lines.slice(1).map((line, index) => {
    const values = parseCSVRow(line).map(v => v.replace(/^"|"$/g, '').trim())
    
    // Validate required fields
    if (!values[0] || values[0].trim() === '') {
      throw new Error(`Row ${index + 2}: Missing required field 'title'`)
    }
    
    return {
      title: values[0],
      keywords: values[1] || '',
      category: values[2] // Optional category column
    }
  })
}

function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

// Available categories (matches API endpoint)
const AVAILABLE_CATEGORIES = [
  'Tone Of Voice Fundamentals',
  'Brand Voice Foundations',
  'Guidelines & Templates',
  'Examples & Case Studies',
  'Channel & Execution'
]

// Category generation function (matches API endpoint logic)
async function generateCategory(topic, keywords) {
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
    let category = result.content.trim()
    category = category.replace(/^`+|`+$/g, '') // Remove markdown code block markers
    category = category.trim()
    
    if (AVAILABLE_CATEGORIES.includes(category)) {
      return category
    }
  }

  return 'Tone Of Voice Fundamentals' // Fallback
}

// Note: Gradient generation is handled on the frontend (BlogCard component)
// The same slug-based hash logic ensures consistent gradients across listing and post pages

function calculateReadingTime(content) {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
}

/**
 * Parse content-batch-plan.md to extract link instructions for a topic
 * @param {string} topicTitle - The topic title to find links for
 * @param {object} supabase - Supabase client to check existing slugs
 * @returns {Promise<object>} Link instructions with internal and external links
 */
async function getLinkInstructions(topicTitle, supabase) {
  const contentPlanPath = path.join(__dirname, 'content-batch-plan.md')
  
  try {
    if (!fs.existsSync(contentPlanPath)) {
      console.log('   ⚠️  Content plan file not found, skipping link instructions')
      return null
    }

    const contentPlan = fs.readFileSync(contentPlanPath, 'utf-8')
    const lines = contentPlan.split('\n')
    
    // Find the row matching this topic title
    let linkPlan = null
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Check if this line contains the topic title (in the Working Title column)
      if (line.includes('|') && line.includes(topicTitle)) {
        // Extract the Internal Link Plan column (last column before closing |)
        const columns = line.split('|').map(col => col.trim())
        if (columns.length >= 6) {
          linkPlan = columns[5] // Internal Link Plan is the 6th column (index 5)
          break
        }
      }
    }

    if (!linkPlan) {
      return null
    }

    // Parse links from the plan (format: "Up: Title<br>Cross: Title1, Title2")
    const internalLinks = []
    const linkPatterns = [
      { prefix: 'Up:', type: 'up' },
      { prefix: 'Cross:', type: 'cross' },
      { prefix: 'Resource:', type: 'resource' }
    ]

    for (const pattern of linkPatterns) {
      const regex = new RegExp(`${pattern.prefix}\\s*([^<]+)`, 'gi')
      let match
      while ((match = regex.exec(linkPlan)) !== null) {
        const titles = match[1].split(',').map(t => t.trim()).filter(t => t)
        for (const title of titles) {
          // Convert title to slug to check if it exists
          const slug = createSlug(title)
          // Check if this slug exists in Supabase
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
      external: [] // External links will come from Firecrawl research notes
    }
  } catch (error) {
    console.warn(`   ⚠️  Error parsing content plan:`, error.message)
    return null
  }
}

// Function to read blog images directory and return sorted filenames
async function getBlogImages() {
  try {
    const blogImagesPath = path.join(__dirname, '..', 'public', 'blog-images')
    
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
    
    return imageFiles
  } catch (error) {
    console.error('Error reading blog images directory:', error)
    return []
  }
}

// Function to select image based on post count (cycling through images)
async function selectBlogImage(supabase) {
  try {
    // Get available images
    const images = await getBlogImages()
    if (images.length === 0) {
      console.log('   ⚠️  No blog images available')
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
    
    console.log(`   🖼️  Selected image ${imageIndex + 1}/${images.length}: ${selectedImage}`)
    return selectedImage
  } catch (error) {
    console.error('Error selecting blog image:', error)
    return null
  }
}

async function generateBlogPost(topic) {
  console.log(`🤖 Generating blog post for: "${topic.title}"`)
  
  try {
    // Validate topic input
    if (!topic || !topic.title || typeof topic.title !== 'string' || topic.title.trim() === '') {
      throw new Error('Invalid topic: title is required')
    }

    // Parse keywords (handle comma-separated string)
    const keywords = topic.keywords ? topic.keywords.split(',').map(k => k.trim()).filter(k => k) : []
    
    // Determine category
    let category = topic.category
    if (!category || !AVAILABLE_CATEGORIES.includes(category)) {
      console.log(`   📂 Generating category for "${topic.title}"...`)
      category = await generateCategory(topic.title, keywords)
    }
    if (!AVAILABLE_CATEGORIES.includes(category)) {
      category = 'Tone Of Voice Fundamentals' // Fallback
    }
    console.log(`   📂 Category: ${category}`)

    // Fetch recent context from Firecrawl search before generating outline
    console.log(`   🔍 Fetching recent context...`)
    let researchNotes = null
    try {
      const searchResult = await searchBrief(topic.title, keywords, 5)
      if (searchResult && searchResult.success) {
        researchNotes = {
          summary: searchResult.summary,
          urls: searchResult.urls,
          markdown: searchResult.markdown // Full markdown for writer agent
        }
        console.log(`   ✅ Found ${searchResult.urls.length} recent sources`)
      } else {
        console.log(`   ⚠️  No search results available (continuing without briefing)`)
      }
    } catch (searchError) {
      console.warn(`   ⚠️  Search briefing failed:`, searchError.message)
      // Continue without research notes if search fails
    }

    // Step 1: Generate outline using gpt-4o
    console.log(`   📝 Generating outline...`)
    const outlinePrompt = getBlogOutlinePrompt(topic.title, keywords, researchNotes)
    const outlineResult = await generateWithOpenAI(
      outlinePrompt,
      SYSTEM_PROMPT,
      'json',
      2000,
      'gpt-4o'
    )

    if (!outlineResult.success || !outlineResult.content) {
      console.error(`❌ Outline generation failed for "${topic.title}":`, outlineResult.error)
      return null
    }

    let outline
    try {
      outline = JSON.parse(outlineResult.content)
    } catch (parseError) {
      console.error(`❌ Failed to parse outline JSON for "${topic.title}":`, parseError.message)
      return null
    }

    console.log(`   ✅ Outline: "${outline.title}"`)
    console.log(`   📋 Format: ${outline.format}`)

    // Get link instructions from content plan
    console.log(`   🔗 Gathering link instructions...`)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    let linkInstructions = await getLinkInstructions(topic.title, supabase)
    
    // Add external links from Firecrawl research notes
    if (researchNotes && researchNotes.urls && researchNotes.urls.length > 0) {
      if (!linkInstructions) {
        linkInstructions = { internal: [], external: [] }
      }
      linkInstructions.external = researchNotes.urls.map(url => ({
        title: url.split('/').pop().replace(/-/g, ' ') || 'Source',
        url: url
      }))
    }

    if (linkInstructions && (linkInstructions.internal.length > 0 || linkInstructions.external.length > 0)) {
      console.log(`   ✅ Found ${linkInstructions.internal.length} internal links, ${linkInstructions.external.length} external links`)
    }

    // Step 2: Generate article from outline using gpt-4o-mini with temperature 0.8
    console.log(`   ✍️  Generating article from outline...`)
    // Outline now contains research_excerpts, so we don't need to pass researchNotes separately
    const articlePrompt = getBlogArticlePromptFromOutline(outline, keywords, linkInstructions)
    
    // Use gpt-4o-mini with temperature 0.8 for article generation
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    
    const articleResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: articlePrompt }
      ],
      temperature: 0.8,
      max_tokens: 4096
    })

    const rawResponse = articleResponse.choices[0]?.message?.content
    if (!rawResponse) {
      throw new Error('Empty response from OpenAI')
    }

    // Log token usage
    if (articleResponse.usage) {
      console.log('='.repeat(50))
      console.log('🔢 TOKEN USAGE SUMMARY')
      console.log('='.repeat(50))
      console.log(`Model: ${articleResponse.model}`)
      console.log(`Prompt tokens: ${articleResponse.usage.prompt_tokens}`)
      console.log(`Completion tokens: ${articleResponse.usage.completion_tokens}`)
      console.log(`Total tokens: ${articleResponse.usage.total_tokens}`)
      console.log('='.repeat(50))
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
    let blogPost
    try {
      blogPost = JSON.parse(result.content)
    } catch (parseError) {
      console.error(`❌ Failed to parse JSON for "${topic.title}":`, parseError.message)
      console.error(`   Raw response preview: ${result.content.substring(0, 200)}...`)
      return null
    }

    // Validate required fields
    if (!blogPost.title || typeof blogPost.title !== 'string') {
      throw new Error('Missing or invalid title in generated content')
    }
    if (!blogPost.content || typeof blogPost.content !== 'string') {
      throw new Error('Missing or invalid content in generated content')
    }
    if (!blogPost.excerpt || typeof blogPost.excerpt !== 'string') {
      throw new Error('Missing or invalid excerpt in generated content')
    }

    // Validate keywords
    if (!Array.isArray(blogPost.keywords)) {
      if (blogPost.keywords && typeof blogPost.keywords === 'string') {
        blogPost.keywords = [blogPost.keywords]
      } else {
        blogPost.keywords = keywords.length > 0 ? keywords : []
      }
    }

    // Calculate additional fields
    const wordCount = blogPost.content.split(/\s+/).length
    const readingTime = calculateReadingTime(blogPost.content)
    const slug = createSlug(blogPost.title)
    const keywordsArray = Array.isArray(blogPost.keywords) ? blogPost.keywords : keywords

    console.log(`   ✅ Generated: ${wordCount} words, ${readingTime} min read`)

    // Note: featured_image will be selected before saving (in saveBlogPost)
    // This ensures we count posts correctly including the one being saved

    return {
      title: blogPost.title,
      slug,
      content: blogPost.content,
      excerpt: blogPost.excerpt,
      keywords: keywordsArray,
      category,
      featured_image: null, // Will be set in saveBlogPost
      author_name: 'Tahi Gichigi',
      author_image: '/logos/profile_orange_clean.png',
      word_count: wordCount,
      reading_time: readingTime,
      is_published: true,
      published_at: new Date().toISOString()
    }
  } catch (error) {
    console.error(`❌ Error generating blog post for "${topic.title}":`, error.message)
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`)
    }
    return null
  }
}

async function saveBlogPost(blogPost) {
  // Lazy initialization of Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Select featured image using cycling logic (same as API endpoint)
  if (!blogPost.featured_image) {
    blogPost.featured_image = await selectBlogImage(supabase)
  }

  if (DRY_RUN) {
    console.log('📝 [DRY RUN] Would save blog post:', {
      title: blogPost.title,
      slug: blogPost.slug,
      word_count: blogPost.word_count,
      reading_time: blogPost.reading_time,
      featured_image: blogPost.featured_image || 'none'
    })
    return { success: true }
  }

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert([blogPost])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        console.log(`⚠️  Blog post with slug "${blogPost.slug}" already exists, skipping...`)
        return { success: false, reason: 'duplicate' }
      }
      throw error
    }

    console.log(`✅ Saved blog post: "${blogPost.title}" (${blogPost.word_count} words)`)
    if (blogPost.featured_image) {
      console.log(`   🖼️  Featured image: ${blogPost.featured_image}`)
    }
    return { success: true, data }
  } catch (error) {
    console.error(`❌ Error saving blog post "${blogPost.title}":`, error.message)
    return { success: false, error: error.message }
  }
}

async function main() {
  console.log('🚀 Starting blog post generation...')
  console.log(`📊 Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`📝 Limit: ${LIMIT} posts`)
  console.log(`📄 CSV Path: ${CSV_PATH}`)
  console.log('')

  // Validate environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required')
    process.exit(1)
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL environment variable is required')
    process.exit(1)
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
    process.exit(1)
  }

  // Read and parse CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_PATH}`)
    console.error(`   💡 Tip: Update CSV_PATH in the script or create a CSV file at this location`)
    console.error(`   📄 Template available at: scripts/blog-topics-template.csv`)
    process.exit(1)
  }

  let topics
  try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
    topics = parseCSV(csvContent)
  } catch (error) {
    console.error(`❌ Error parsing CSV file: ${error.message}`)
    process.exit(1)
  }
  
  console.log(`📋 Found ${topics.length} topics in CSV`)
  
  // Process topics (limited by LIMIT)
  const topicsToProcess = topics.slice(0, LIMIT)
  console.log(`🎯 Processing ${topicsToProcess.length} topics`)
  console.log('')

  let successful = 0
  let failed = 0
  let skipped = 0

  for (const [index, topic] of topicsToProcess.entries()) {
    console.log(`\n[${index + 1}/${topicsToProcess.length}]`)
    
    // Generate blog post
    const blogPost = await generateBlogPost(topic)
    if (!blogPost) {
      failed++
      continue
    }

    // Save blog post
    const result = await saveBlogPost(blogPost)
    if (result.success) {
      successful++
    } else if (result.reason === 'duplicate') {
      skipped++
    } else {
      failed++
    }

    // Rate limiting - wait 2 seconds between requests
    if (index < topicsToProcess.length - 1) {
      console.log('⏳ Waiting 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log('\n🎉 Generation complete!')
  console.log(`✅ Successful: ${successful}`)
  console.log(`⚠️  Skipped (duplicates): ${skipped}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total processed: ${successful + skipped + failed}`)
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})
