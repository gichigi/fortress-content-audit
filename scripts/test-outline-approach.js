/**
 * Test script for two-step blog generation:
 * 1. Generate outline first
 * 2. Generate article from outline
 * 
 * Tests template keyword handling and keyword usage in articles
 */

import dotenv from 'dotenv'
import OpenAI from 'openai'
import { BLOG_SYSTEM_PROMPT, getBlogOutlinePrompt, getBlogArticlePromptFromOutline } from '../lib/blog-prompts.js'

dotenv.config()

// Standalone generateWithOpenAI function (matches generate-blog-posts.js logic)
async function generateWithOpenAI(prompt, systemPrompt, responseFormat = 'json', max_tokens = 2000, model = 'gpt-4o-mini') {
  const maxAttempts = 3
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

// Test topics with varied keywords to test different formats and scenarios
const testTopics = [
  {
    title: 'Brand guidelines template',
    keywords: ['brand guidelines template', 'brand', 'guidelines', 'template']
  },
  {
    title: '5 brand voice mistakes',
    keywords: ['brand voice mistakes', 'brand voice errors', 'brand voice tips']
  },
  {
    title: 'Brand voice vs tone',
    keywords: ['brand voice', 'tone of voice', 'brand voice vs tone', 'difference']
  },
  {
    title: 'How to create a style guide',
    keywords: ['how to create style guide', 'style guide creation', 'brand style guide']
  },
  {
    title: 'Brand voice examples',
    keywords: ['brand voice examples', 'brand voice inspiration', 'successful brand voices']
  },
  {
    title: 'Content style guide template',
    keywords: ['content style guide template', 'content guidelines', 'editorial style guide']
  }
]

/**
 * Generate outline for a blog post
 */
async function generateOutline(topic, keywords) {
  // Check if topic or keywords mention template
  const hasTemplateKeyword = topic.toLowerCase().includes('template') || 
                             keywords.some(k => k.toLowerCase().includes('template'))
  
  // Use the actual prompt function
  const outlinePrompt = getBlogOutlinePrompt(topic, keywords, null)

  console.log(`\n📝 Generating outline for: "${topic}"`)
  console.log(`   Template keyword detected: ${hasTemplateKeyword}`)
  
  const result = await generateWithOpenAI(
    outlinePrompt,
    BLOG_SYSTEM_PROMPT,
    'json',
    2000,
    'gpt-4o'
  )

  if (!result.success || !result.content) {
    console.error(`❌ Outline generation failed:`, result.error)
    return null
  }

  try {
    const outline = JSON.parse(result.content)
    
    console.log(`\n📋 Outline Generated:`)
    console.log(`   Title: "${outline.title}"`)
    console.log(`   Format: ${outline.format}`)
    console.log(`   Sections: ${outline.sections?.length || 0}`)
    
    // Check template keyword presence
    const topicHasTemplate = topic.toLowerCase().includes('template') || 
                             keywords.some(k => k.toLowerCase().includes('template'))
    const titleHasTemplate = outline.title.toLowerCase().includes('template')
    
    if (topicHasTemplate && !titleHasTemplate) {
      console.log(`   ⚠️  WARNING: Topic/keywords mention template but title doesn't include it!`)
      console.log(`   ⚠️  This may hurt SEO - users searching for templates won't find this`)
    }
    
    if (topicHasTemplate && titleHasTemplate) {
      console.log(`   ✅ Good: Topic mentions template and title includes it for SEO`)
    }
    
    return outline
  } catch (parseError) {
    console.error(`❌ Failed to parse outline JSON:`, parseError.message)
    console.error(`   Raw response: ${result.content.substring(0, 200)}...`)
    return null
  }
}

/**
 * Generate article from outline
 */
async function generateArticleFromOutline(outline, topic, keywords) {
  // Use the actual prompt function
  const articlePrompt = getBlogArticlePromptFromOutline(outline, keywords, null)

  console.log(`\n✍️  Generating article from outline...`)
  
  const result = await generateWithOpenAI(
    articlePrompt,
    BLOG_SYSTEM_PROMPT,
    'json',
    4096,
    'gpt-4o-mini'
  )

  if (!result.success || !result.content) {
    console.error(`❌ Article generation failed:`, result.error)
    return null
  }

  try {
    const article = JSON.parse(result.content)
    
    // Check keyword usage in article
    const contentLower = article.content.toLowerCase()
    const keywordsLower = keywords.map(k => k.toLowerCase())
    const keywordUsage = keywordsLower.map(kw => {
      const count = (contentLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      return { keyword: kw, count }
    })
    
    console.log(`\n✅ Article Generated:`)
    console.log(`   Title: "${article.title}"`)
    console.log(`   Word Count: ${article.content.split(/\s+/).length}`)
    console.log(`   Keyword Usage:`)
    keywordUsage.forEach(({ keyword, count }) => {
      const status = count > 0 ? '✅' : '⚠️'
      console.log(`     ${status} "${keyword}": ${count} times`)
    })
    
    // Check if template keyword is used when present
    const topicHasTemplate = topic.toLowerCase().includes('template') || 
                             keywords.some(k => k.toLowerCase().includes('template'))
    if (topicHasTemplate) {
      const templateKeywordUsed = keywordUsage.some(kw => kw.keyword.includes('template') && kw.count > 0)
      if (!templateKeywordUsed) {
        console.log(`   ⚠️  WARNING: Template keyword not used in article content!`)
      }
    }
    
    return article
  } catch (parseError) {
    console.error(`❌ Failed to parse article JSON:`, parseError.message)
    return null
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 Testing Two-Step Blog Generation (Outline → Article)')
  console.log('=' .repeat(60))
  
  for (const topic of testTopics) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: "${topic.title}"`)
    console.log('='.repeat(60))
    
    // Step 1: Generate outline
    const outline = await generateOutline(topic.title, topic.keywords)
    
    if (!outline) {
      console.log(`❌ Skipping article generation due to outline failure`)
      continue
    }
    
    // Step 2: Generate article from outline
    const article = await generateArticleFromOutline(outline, topic.title, topic.keywords)
    
    if (article) {
      console.log(`\n✅ Test complete for "${topic.title}"`)
    }
    
    // Wait between tests
    if (testTopics.indexOf(topic) < testTopics.length - 1) {
      console.log(`\n⏳ Waiting 3 seconds before next test...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log('🎉 All tests complete!')
}

main().catch(error => {
  console.error('❌ Test script error:', error)
  process.exit(1)
})

