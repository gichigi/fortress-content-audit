#!/usr/bin/env node

/**
 * Generate blog post and output in markdown format (dry run)
 * Usage: node scripts/generate-blog-dry-run.js "Topic Title" "keywords" "category"
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { BLOG_SYSTEM_PROMPT, getBlogOutlinePrompt, getBlogArticlePromptFromOutline } from '../lib/blog-prompts.js'
import { searchBrief } from '../lib/firecrawl.js'
import OpenAI from 'openai'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Standalone generateWithOpenAI function
async function generateWithOpenAI(prompt, systemPrompt, responseFormat = 'json', max_tokens = 2000, model = 'gpt-4o-mini') {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: max_tokens,
      response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined
    })

    return {
      success: true,
      content: response.choices[0].message.content
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

async function generateCategory(topic, keywords) {
  const AVAILABLE_CATEGORIES = [
    'Tone Of Voice Fundamentals',
    'Brand Voice Foundations',
    'Guidelines & Templates',
    'Examples & Case Studies',
    'Channel & Execution'
  ]
  
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

  if (result.success) {
    const category = result.content.trim()
    return AVAILABLE_CATEGORIES.includes(category) ? category : 'Tone Of Voice Fundamentals'
  }
  
  return 'Tone Of Voice Fundamentals'
}

async function main() {
  const topic = process.argv[2]
  const keywordsStr = process.argv[3] || ''
  const categoryOverride = process.argv[4]

  if (!topic) {
    console.error('Usage: node scripts/generate-blog-dry-run.js "Topic Title" [keywords] [category]')
    process.exit(1)
  }

  const keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : []
  const category = categoryOverride || await generateCategory(topic, keywords)

  console.log(`📝 Generating blog post: "${topic}"`)
  console.log(`📂 Category: ${category}`)
  console.log(`🔑 Keywords: ${keywords.join(', ') || 'none'}`)
  console.log('')

  // Fetch research
  let researchNotes = null
  try {
    console.log('🔍 Fetching recent context...')
    const searchResult = await searchBrief(topic, keywords, 5)
    if (searchResult && searchResult.success) {
      researchNotes = {
        summary: searchResult.summary,
        urls: searchResult.urls,
        markdown: searchResult.markdown
      }
      console.log(`✅ Found ${searchResult.urls.length} recent sources`)
    }
  } catch (error) {
    console.log('⚠️  Search failed, continuing without research')
  }

  // Generate outline
  console.log('📝 Generating outline...')
  const outlinePrompt = getBlogOutlinePrompt(topic, keywords, researchNotes)
  const outlineResult = await generateWithOpenAI(
    outlinePrompt,
    BLOG_SYSTEM_PROMPT,
    'json',
    2000,
    'gpt-4o'
  )

  if (!outlineResult.success || !outlineResult.content) {
    console.error('❌ Outline generation failed:', outlineResult.error)
    process.exit(1)
  }

  let outline
  try {
    // Clean JSON response
    let cleaned = outlineResult.content.trim()
    cleaned = cleaned.replace(/```(json|markdown)\n?/g, '').replace(/```\n?/g, '')
    const jsonStart = Math.min(
      cleaned.indexOf('[') >= 0 ? cleaned.indexOf('[') : Infinity,
      cleaned.indexOf('{') >= 0 ? cleaned.indexOf('{') : Infinity
    )
    if (jsonStart < Infinity) {
      let jsonText = cleaned.substring(jsonStart)
      for (let i = jsonText.length; i > 0; i--) {
        try {
          const candidate = jsonText.substring(0, i)
          JSON.parse(candidate)
          cleaned = candidate
          break
        } catch (e) {
          // Continue
        }
      }
    }
    outline = JSON.parse(cleaned)
  } catch (parseError) {
    console.error('❌ Failed to parse outline JSON:', parseError.message)
    console.error('Raw response:', outlineResult.content.substring(0, 500))
    process.exit(1)
  }

  console.log(`✅ Outline: "${outline.title}"`)
  console.log(`📋 Format: ${outline.format}`)

  // Generate article
  console.log('✍️  Generating article...')
  const articlePrompt = getBlogArticlePromptFromOutline(outline, keywords, null)
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  const articleResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: BLOG_SYSTEM_PROMPT },
      { role: 'user', content: articlePrompt }
    ],
    temperature: 0.8,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  })

  const rawResponse = articleResponse.choices[0]?.message?.content
  if (!rawResponse) {
    console.error('❌ Empty response from OpenAI')
    process.exit(1)
  }

  let article
  try {
    // Clean JSON response
    let cleaned = rawResponse.trim()
    cleaned = cleaned.replace(/```(json|markdown)\n?/g, '').replace(/```\n?/g, '')
    
    // Try to parse the full cleaned response first
    try {
      article = JSON.parse(cleaned)
    } catch (firstError) {
      // If that fails, try to find JSON object boundaries
      const jsonStart = Math.min(
        cleaned.indexOf('[') >= 0 ? cleaned.indexOf('[') : Infinity,
        cleaned.indexOf('{') >= 0 ? cleaned.indexOf('{') : Infinity
      )
      
      if (jsonStart < Infinity) {
        let jsonText = cleaned.substring(jsonStart)
        // Try parsing from the start, working backwards from the end
        let parsed = null
        for (let i = jsonText.length; i > 0; i--) {
          try {
            const candidate = jsonText.substring(0, i)
            parsed = JSON.parse(candidate)
            // Check if we got a complete object with expected fields
            if (parsed && (parsed.title || parsed.content)) {
              article = parsed
              break
            }
          } catch (e) {
            // Continue trying shorter strings
          }
        }
        
        if (!article) {
          fs.writeFileSync(path.join(__dirname, 'raw-article-response.txt'), rawResponse)
          throw new Error('Could not parse valid JSON from response')
        }
      } else {
        throw firstError
      }
    }
    
    // Validate article has required fields
    if (!article.content) {
      fs.writeFileSync(path.join(__dirname, 'raw-article-response.txt'), rawResponse)
      console.error('❌ Article JSON missing content field')
      console.error('Article keys:', Object.keys(article))
      process.exit(1)
    }
  } catch (parseError) {
    fs.writeFileSync(path.join(__dirname, 'raw-article-response.txt'), rawResponse)
    console.error('❌ Failed to parse article JSON:', parseError.message)
    console.error('Raw response (first 1000 chars):', rawResponse.substring(0, 1000))
    process.exit(1)
  }

  console.log('✅ Article generated')

  // Generate markdown output
  const output = `# Dry Run Output - ${topic}

**Generated:** ${new Date().toISOString()}

## Topic
**Title:** ${topic}
**Keywords:** ${keywords.join(', ') || 'none'}

---

## Outline

**Title:** ${outline.title}
**Format:** ${outline.format}

### Sections

${outline.sections.map((s, i) => `${i + 1}. **${s.heading}**\n   Topics: ${(s.topics || s.key_points || []).join(', ')}`).join('\n\n')}

${outline.research_excerpts && outline.research_excerpts.length > 0 ? `### Research Excerpts

${outline.research_excerpts.map((source, i) => {
  const snippets = Array.isArray(source.snippets) && source.snippets.length > 0
    ? source.snippets
    : (source.excerpt || source.context)
      ? [{ excerpt: source.excerpt, context: source.context, section: source.section }]
      : []

  const snippetText = snippets.map((snippet, idx) => {
    const sectionLine = snippet.section ? `\n      Section: ${snippet.section}` : ''
    return `   - Snippet ${idx + 1}: ${snippet.context || 'Context not provided'}${sectionLine}\n      "${snippet.excerpt || ''}"`
  }).join('\n')

  return `${i + 1}. Source: ${source.source_url || 'unknown'}\n${snippetText || '   - (No snippets provided)'}`
}).join('\n\n')}

` : ''}---

## Article

**Title:** ${article.title}
**Excerpt:** ${article.excerpt}
**Keywords:** ${article.keywords ? article.keywords.join(', ') : 'none provided'}

### Content

${article.content}

---

## Full JSON

### Outline JSON
\`\`\`json
${JSON.stringify(outline, null, 2)}
\`\`\`

### Article JSON
\`\`\`json
${JSON.stringify(article, null, 2)}
\`\`\`
`

  // Write to file
  const outputPath = path.join(__dirname, 'dry-run-output.md')
  fs.writeFileSync(outputPath, output)
  console.log(`\n✅ Output saved to: ${outputPath}`)
}

main().catch(error => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})

