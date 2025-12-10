#!/usr/bin/env node

/**
 * Update existing blog posts without featured images
 * Adds featured images using the same cycling logic
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Function to read blog images directory
async function getBlogImages() {
  try {
    const blogImagesPath = path.join(__dirname, '..', 'public', 'blog-images')
    
    if (!fs.existsSync(blogImagesPath)) {
      console.error('Blog images directory not found:', blogImagesPath)
      return []
    }
    
    const files = await fs.promises.readdir(blogImagesPath)
    const imageFiles = files
      .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
      .sort()
    
    return imageFiles
  } catch (error) {
    console.error('Error reading blog images directory:', error)
    return []
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Get all posts without featured images
  const { data: posts, error: fetchError } = await supabase
    .from('blog_posts')
    .select('id, title, slug, created_at')
    .is('featured_image', null)
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('Error fetching posts:', fetchError)
    process.exit(1)
  }

  if (!posts || posts.length === 0) {
    console.log('✅ All posts already have featured images!')
    process.exit(0)
  }

  console.log(`📋 Found ${posts.length} posts without featured images`)
  
  const images = await getBlogImages()
  if (images.length === 0) {
    console.error('❌ No blog images available')
    process.exit(1)
  }

  console.log(`🖼️  Found ${images.length} available images\n`)

  // Update each post
  let updated = 0
  let failed = 0

  for (const [index, post] of posts.entries()) {
    // Calculate image index based on post creation order
    const imageIndex = index % images.length
    const featuredImage = `/blog-images/${images[imageIndex]}`

    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({ featured_image: featuredImage })
      .eq('id', post.id)

    if (updateError) {
      console.error(`❌ Failed to update "${post.title}":`, updateError.message)
      failed++
    } else {
      console.log(`✅ Updated "${post.title}"`)
      console.log(`   🖼️  Image: ${featuredImage}`)
      updated++
    }
  }

  console.log(`\n🎉 Update complete!`)
  console.log(`✅ Updated: ${updated}`)
  console.log(`❌ Failed: ${failed}`)
}

main().catch(console.error)

