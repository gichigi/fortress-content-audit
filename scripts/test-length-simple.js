import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function testLength() {
  const topic = 'Brand Voice Guidelines'
  const keywords = ['brand voice', 'voice guidelines', 'tone of voice']

  console.log('🧪 Testing length with minimal prompts (using gpt-4o)\n')
  console.log(`Topic: ${topic}`)
  console.log(`Keywords: ${keywords.join(', ')}\n`)

  // Step 1: Generate outline with minimal prompt
  console.log('📋 Step 1: Generating outline...')
  const outlinePrompt = `Generate a blog post outline about: ${topic}

Keywords: ${keywords.join(', ')}

Return as JSON:
{
  "title": "title here",
  "format": "Guide",
  "sections": [
    {"heading": "Section 1", "topics": ["topic 1", "topic 2"]},
    {"heading": "Section 2", "topics": ["topic 1", "topic 2"]}
  ]
}`

  const outlineResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: outlinePrompt }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  })

  const outline = JSON.parse(outlineResponse.choices[0].message.content)
  console.log(`✅ Outline: "${outline.title}"`)
  console.log(`   Sections: ${outline.sections.length}\n`)

  // Step 2: Generate article with minimal prompt + length requirement
  console.log('✍️  Step 2: Generating article...')
  const articlePrompt = `Write a blog post based on this outline:

Title: ${outline.title}
Format: ${outline.format}

Sections:
${outline.sections.map((s, i) => `${i + 1}. ${s.heading}\n   Topics: ${s.topics.join(', ')}`).join('\n\n')}

IMPORTANT: Target 2,500-4,000 tokens (~800-1,500 words). Write a comprehensive, detailed article. Expand each section fully with examples and explanations.

Return as JSON:
{
  "title": "title",
  "content": "full markdown content starting with # Title",
  "excerpt": "brief excerpt",
  "keywords": ["keyword1", "keyword2"]
}`

  const articleResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: articlePrompt }
    ],
    temperature: 0.8,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  })

  const article = JSON.parse(articleResponse.choices[0].message.content)
  
  // Calculate word count
  const wordCount = article.content.split(/\s+/).length
  const estimatedTokens = Math.ceil(wordCount * 1.3)

  console.log(`✅ Article generated`)
  console.log(`\n📊 LENGTH RESULTS:`)
  console.log(`   Words: ${wordCount}`)
  console.log(`   Estimated tokens: ${estimatedTokens}`)
  console.log(`   Target: 2,500-4,000 tokens`)
  console.log(`   Status: ${estimatedTokens >= 2500 ? '✅ MEETS TARGET' : '❌ BELOW TARGET'}`)
  
  // Show token usage if available
  if (articleResponse.usage) {
    console.log(`\n🔢 ACTUAL TOKEN USAGE:`)
    console.log(`   Prompt tokens: ${articleResponse.usage.prompt_tokens}`)
    console.log(`   Completion tokens: ${articleResponse.usage.completion_tokens}`)
    console.log(`   Total tokens: ${articleResponse.usage.total_tokens}`)
  }

  // Save to file
  const fs = await import('fs')
  const output = {
    topic,
    keywords,
    outline,
    article: {
      title: article.title,
      wordCount,
      estimatedTokens,
      actualTokens: articleResponse.usage?.completion_tokens || null,
      content: article.content
    }
  }

  fs.writeFileSync(
    'scripts/test-length-output.json',
    JSON.stringify(output, null, 2)
  )

  console.log(`\n💾 Full output saved to: scripts/test-length-output.json`)
  console.log(`\n📄 Article preview (first 500 chars):`)
  console.log(article.content.substring(0, 500) + '...\n')
}

testLength().catch(console.error)

