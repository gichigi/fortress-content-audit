/**
 * End-to-end test script for blog generation
 * Captures all outputs: research, outline, article
 */

import dotenv from 'dotenv'
import OpenAI from 'openai'
import { searchBrief } from '../lib/firecrawl.js'
import { getBlogOutlinePrompt, getBlogArticlePromptFromOutline, BLOG_SYSTEM_PROMPT } from '../lib/blog-prompts.js'
import fs from 'fs'

dotenv.config()

const topic = {
  title: "Brand Voice 101: Build a Standout Voice That Sticks",
  keywords: ["brand voice", "what is brand voice", "brand voice meaning"],
  category: "Brand Voice Foundations"
}

const outputFile = 'end-to-end-test-output.md'

async function main() {
  const outputs = {
    timestamp: new Date().toISOString(),
    topic: topic.title,
    keywords: topic.keywords,
    research: null,
    outline: null,
    article: null,
    errors: []
  }

  console.log('='.repeat(70))
  console.log('END-TO-END BLOG GENERATION TEST')
  console.log('='.repeat(70))
  console.log(`Topic: ${topic.title}`)
  console.log(`Keywords: ${topic.keywords.join(', ')}`)
  console.log('\n')

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  // Step 1: Fetch research
  console.log('Step 1: Fetching research from Firecrawl...')
  let researchNotes = null
  try {
    const searchResult = await searchBrief(topic.title, topic.keywords, 5)
    if (searchResult && searchResult.success) {
      researchNotes = {
        summary: searchResult.summary,
        urls: searchResult.urls,
        markdown: searchResult.markdown
      }
      outputs.research = {
        summary: searchResult.summary,
        urls: searchResult.urls,
        markdown_count: searchResult.markdown?.length || 0,
        markdown_previews: searchResult.markdown?.map(m => ({
          title: m.title,
          url: m.url,
          length: m.markdown?.length || 0,
          preview: m.markdown?.substring(0, 500) || ''
        })) || []
      }
      console.log(`✅ Found ${searchResult.urls.length} sources`)
      console.log(`   Total markdown: ${outputs.research.markdown_previews.reduce((sum, m) => sum + m.length, 0)} chars\n`)
    } else {
      console.log('⚠️  No research results\n')
    }
  } catch (error) {
    outputs.errors.push({ step: 'research', error: error.message })
    console.error('❌ Research failed:', error.message, '\n')
  }

  // Step 2: Generate outline
  console.log('Step 2: Generating outline...')
  try {

    const outlinePrompt = getBlogOutlinePrompt(topic.title, topic.keywords, researchNotes)
    
    const outlineResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: BLOG_SYSTEM_PROMPT },
        { role: 'user', content: outlinePrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 2000
    })

    const outline = JSON.parse(outlineResponse.choices[0].message.content)
    outputs.outline = {
      raw: outline,
      prompt_length: outlinePrompt.length,
      response_tokens: outlineResponse.usage?.total_tokens || 0
    }
    console.log(`✅ Outline generated`)
    console.log(`   Sections: ${outline.sections?.length || 0}`)
    console.log(`   Research excerpts: ${outline.research_excerpts?.length || 0}\n`)
  } catch (error) {
    outputs.errors.push({ step: 'outline', error: error.message })
    console.error('❌ Outline generation failed:', error.message, '\n')
  }

  // Step 3: Generate article
  if (outputs.outline) {
    console.log('Step 3: Generating article...')
    try {
      const articlePrompt = getBlogArticlePromptFromOutline(
        outputs.outline.raw,
        topic.keywords,
        null  // linkInstructions
      )

      const articleResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: BLOG_SYSTEM_PROMPT },
          { role: 'user', content: articlePrompt }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
        max_tokens: 4096
      })

      const article = JSON.parse(articleResponse.choices[0].message.content)
      outputs.article = {
        raw: article,
        prompt_length: articlePrompt.length,
        response_tokens: articleResponse.usage?.total_tokens || 0,
        content_length: article.content?.length || 0,
        estimated_words: Math.round((article.content?.length || 0) / 4.5)
      }
      console.log(`✅ Article generated`)
      console.log(`   Content length: ${outputs.article.content_length} chars`)
      console.log(`   Estimated words: ~${outputs.article.estimated_words}\n`)
    } catch (error) {
      outputs.errors.push({ step: 'article', error: error.message })
      console.error('❌ Article generation failed:', error.message, '\n')
    }
  }

  // Write to markdown file
  console.log('Writing outputs to markdown file...')
  const markdown = formatOutputsAsMarkdown(outputs)
  fs.writeFileSync(outputFile, markdown)
  console.log(`✅ Outputs saved to ${outputFile}`)
}

function formatOutputsAsMarkdown(outputs) {
  let md = `# End-to-End Blog Generation Test\n\n`
  md += `**Generated:** ${outputs.timestamp}\n\n`
  md += `## Topic\n\n`
  md += `**Title:** ${outputs.topic}\n\n`
  md += `**Keywords:** ${outputs.keywords.join(', ')}\n\n`
  md += `---\n\n`

  // Research Section
  md += `## Step 1: Research (Firecrawl)\n\n`
  if (outputs.research) {
    md += `**Sources Found:** ${outputs.research.urls.length}\n\n`
    md += `### Source URLs\n\n`
    outputs.research.urls.forEach((url, i) => {
      md += `${i + 1}. ${url}\n`
    })
    md += `\n### Research Summary\n\n${outputs.research.summary}\n\n`
    
    if (outputs.research.markdown_previews.length > 0) {
      md += `### Markdown Previews\n\n`
      outputs.research.markdown_previews.forEach((preview, i) => {
        md += `#### Source ${i + 1}: ${preview.title}\n\n`
        md += `**URL:** ${preview.url}\n\n`
        md += `**Length:** ${preview.length} characters\n\n`
        md += `**Preview:**\n\n${preview.preview}...\n\n---\n\n`
      })
    }
  } else {
    md += `No research data available.\n\n`
  }

  // Outline Section
  md += `## Step 2: Outline Generation\n\n`
  if (outputs.outline) {
    const outline = outputs.outline.raw
    md += `**Prompt Length:** ${outputs.outline.prompt_length} characters\n`
    md += `**Response Tokens:** ${outputs.outline.response_tokens}\n\n`
    md += `### Outline JSON\n\n\`\`\`json\n${JSON.stringify(outline, null, 2)}\n\`\`\`\n\n`
    
    md += `### Outline Summary\n\n`
    md += `**Title:** ${outline.title}\n\n`
    md += `**Format:** ${outline.format}\n\n`
    md += `**Sections:** ${outline.sections?.length || 0}\n\n`
    
    if (outline.sections) {
      md += `#### Sections:\n\n`
      outline.sections.forEach((section, i) => {
        md += `${i + 1}. **${section.heading}**\n`
        if (section.key_points && section.key_points.length > 0) {
          section.key_points.forEach(point => {
            md += `   - ${point}\n`
          })
        }
        md += `\n`
      })
    }

    if (outline.research_excerpts && outline.research_excerpts.length > 0) {
      md += `### Research Excerpts Extracted\n\n`
      outline.research_excerpts.forEach((source, i) => {
        const snippets = Array.isArray(source.snippets) && source.snippets.length > 0
          ? source.snippets
          : (source.excerpt || source.context)
            ? [{ excerpt: source.excerpt, context: source.context, section: source.section }]
            : []
        md += `${i + 1}. Source: ${source.source_url}\n`
        if (snippets.length === 0) {
          md += `   - (No snippets provided)\n\n`
          return
        }
        snippets.forEach((snippet, idx) => {
          const excerptPreview = (snippet.excerpt || '').substring(0, 200)
          md += `   - Snippet ${idx + 1}: ${snippet.context || 'Context not provided'}\n`
          if (snippet.section) {
            md += `     Section: ${snippet.section}\n`
          }
          md += `     "${excerptPreview}${(snippet.excerpt || '').length > 200 ? '...' : ''}"\n`
        })
        md += `\n`
      })
    }
  } else {
    md += `Outline generation failed.\n\n`
  }

  // Article Section
  md += `## Step 3: Article Generation\n\n`
  if (outputs.article) {
    const article = outputs.article.raw
    md += `**Prompt Length:** ${outputs.article.prompt_length} characters\n`
    md += `**Response Tokens:** ${outputs.article.response_tokens}\n`
    md += `**Content Length:** ${outputs.article.content_length} characters\n`
    md += `**Estimated Words:** ~${outputs.article.estimated_words}\n\n`
    
    md += `### Article Title\n\n${article.title || 'N/A'}\n\n`
    md += `### Article Content\n\n${article.content || 'N/A'}\n\n`
    
    md += `### Full Article JSON\n\n\`\`\`json\n${JSON.stringify(article, null, 2)}\n\`\`\`\n\n`
  } else {
    md += `Article generation failed.\n\n`
  }

  // Errors Section
  if (outputs.errors.length > 0) {
    md += `## Errors\n\n`
    outputs.errors.forEach(error => {
      md += `- **${error.step}:** ${error.error}\n`
    })
    md += `\n`
  }

  return md
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

