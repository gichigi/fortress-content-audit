#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: path.resolve(process.cwd(), '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PLAN_PATH = path.resolve(__dirname, 'content-batch-plan.md')

const args = process.argv.slice(2)
const options = {
  dryRun: false,
  slug: null,
  batch: null,
  limit: null,
}

for (const arg of args) {
  if (arg === '--dry-run') {
    options.dryRun = true
  } else if (arg.startsWith('--slug=')) {
    options.slug = arg.split('=')[1]
  } else if (arg.startsWith('--batch=')) {
    options.batch = arg.split('=')[1]
  } else if (arg.startsWith('--limit=')) {
    const value = parseInt(arg.split('=')[1], 10)
    if (!Number.isNaN(value) && value > 0) {
      options.limit = value
    }
  }
}

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[`"'’]/g, '')
    .trim()
}

function parseContentPlan(content) {
  const lines = content.split('\n')
  const rows = []
  let currentBatch = null

  for (const line of lines) {
    const batchMatch = line.match(/^###\s+Batch\s+(\d+)\s+—/)
    if (batchMatch) {
      currentBatch = batchMatch[1]
      continue
    }

    if (!line.startsWith('|')) continue
    if (line.includes('---')) continue
    if (line.toLowerCase().includes('working title')) continue

    const fields = line
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)

    if (fields.length < 7) continue

    const [index, pillar, primaryKeyword, workingTitle, articleUrl, supporting, internalPlan] = fields

    rows.push({
      index,
      batch: currentBatch,
      pillar,
      primaryKeyword,
      workingTitle,
      articleUrl,
      supporting,
      internalPlan,
    })
  }

  return rows
}

function extractLinkTargets(internalPlan) {
  if (!internalPlan) {
    return { up: [], cross: [], resource: [] }
  }

  const blocks = internalPlan.split(/<br\s*\/?>/i).map((block) => block.trim())
  const targets = { up: [], cross: [], resource: [] }

  for (const block of blocks) {
    const parts = block.split(':')
    if (parts.length < 2) continue
    const label = parts.shift()
    const rest = parts.join(':')
    const values = rest.split(',').map((item) => item.trim()).filter(Boolean)

    const key = label.trim().toLowerCase()
    if (key.startsWith('up')) {
      targets.up.push(...values)
    } else if (key.startsWith('cross')) {
      for (const value of values) {
        const [rawLabel, rawAnchor] = value.split('|').map((part) => part.trim())
        if (!rawLabel) continue
        targets.cross.push({
          label: rawLabel,
          anchor: rawAnchor || null,
        })
      }
    } else if (key.startsWith('resource')) {
      targets.resource.push(...values)
    }
  }

  return targets
}

function sentenceWithLinks(intro, links) {
  if (!links.length) return ''
  if (links.length === 1) {
    return `${intro} ${links[0]}`
  }

  const allButLast = links.slice(0, -1)
  const last = links[links.length - 1]
  return `${intro} ${allButLast.join(', ')} and ${last}`
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase credentials in environment.')
  }
  return createClient(url, key)
}

const CROSS_INTROS = [
  'Next steps: explore',
  'Next steps: dive into',
  'Next steps: bookmark',
  'Next steps: build on',
  'Next steps: continue with',
]

function pickCrossIntro(slug) {
  if (!slug) return CROSS_INTROS[0]
  const hash = [...slug].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return CROSS_INTROS[hash % CROSS_INTROS.length]
}

async function main() {
  const planContent = fs.readFileSync(PLAN_PATH, 'utf8')
  const allPlanRows = parseContentPlan(planContent)
  if (!allPlanRows.length) {
    console.log('No plan rows found with current filters.')
    return
  }

  let selectedPlanRows = allPlanRows
  if (options.batch) {
    selectedPlanRows = selectedPlanRows.filter((row) => row.batch === options.batch)
  }

  if (!selectedPlanRows.length) {
    console.log('No plan rows found with current filters.')
    return
  }

  if (options.limit) {
    selectedPlanRows = selectedPlanRows.slice(0, options.limit)
  }

  const supabase = createSupabaseClient()
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id, title, slug, content, is_published, keywords')

  if (error) {
    throw new Error(`Failed to fetch blog posts: ${error.message}`)
  }

  const slugFilter = options.slug
  const postBySlug = new Map()
  const keywordMap = new Map()

  for (const post of posts) {
    postBySlug.set(post.slug, post)
    const keywords = post.keywords || []
    for (const keyword of keywords) {
      const key = normalize(keyword)
      if (!keywordMap.has(key)) {
        keywordMap.set(key, [])
      }
      keywordMap.get(key).push(post)
    }
  }

  const planRowToPostAll = new Map()
  const pillarHub = new Map()

  for (const row of allPlanRows) {
    let selected = null
    let slugFromUrl = null

    if (row.articleUrl) {
      const slugMatch = row.articleUrl.match(/\/blog\/([^/?#]+)/)
      if (slugMatch) {
        slugFromUrl = slugMatch[1]
        if (postBySlug.has(slugFromUrl)) {
          selected = postBySlug.get(slugFromUrl)
        }
      }
    }

    if (!selected) {
      const keywordKey = normalize(row.primaryKeyword)
      const candidates = keywordMap.get(keywordKey) || []
      if (slugFilter) {
        selected =
          candidates.find((post) => post.slug === slugFilter) ||
          candidates.find((post) => post.is_published)
      } else {
        selected = candidates.find((post) => post.is_published)
      }
    }

    if (selected) {
      planRowToPostAll.set(row, selected)
      if (!pillarHub.has(row.pillar) || normalize(row.index) === '1') {
        pillarHub.set(row.pillar, selected)
      }
    }
  }

  const postToPlanRow = new Map()
  for (const [row, post] of planRowToPostAll.entries()) {
    if (!postToPlanRow.has(post.slug)) {
      postToPlanRow.set(post.slug, row)
    }
  }

  const planRowsWithPosts = selectedPlanRows.filter((row) => {
    if (!planRowToPostAll.has(row)) return false
    if (!slugFilter) return true
    if (row.articleUrl) {
      const slugMatch = row.articleUrl.match(/\/blog\/([^/?#]+)/)
      if (slugMatch && slugMatch[1] === slugFilter) {
        return true
      }
    }
    const post = planRowToPostAll.get(row)
    return post?.slug === slugFilter
  })

  if (!planRowsWithPosts.length) {
    console.log('No posts matched the provided filters.')
    return
  }

  const resolveTarget = (label) => {
    const normalizedLabel = normalize(label)
    if (!normalizedLabel) return null

    if (/^https?:\/\//.test(label)) {
      const slugMatch = label.match(/\/blog\/([^/?#]+)/)
      if (slugMatch) {
        const slug = slugMatch[1]
        if (postBySlug.has(slug)) {
          return postBySlug.get(slug)
        }
        if (postToPlanRow.has(slug)) {
          const planRow = postToPlanRow.get(slug)
          return planRowToPostAll.get(planRow)
        }
        return {
          slug,
          title: slug.replace(/-/g, ' '),
        }
      }
    }

    const directMatch = allPlanRows.find((row) => normalize(row.workingTitle).includes(normalizedLabel))
    if (directMatch && planRowToPostAll.has(directMatch)) {
      return planRowToPostAll.get(directMatch)
    }

    const keywordMatch = allPlanRows.find((row) => normalize(row.primaryKeyword) === normalizedLabel)
    if (keywordMatch && planRowToPostAll.has(keywordMatch)) {
      return planRowToPostAll.get(keywordMatch)
    }

    const partialMatch = allPlanRows.find((row) => normalize(row.primaryKeyword).includes(normalizedLabel))
    if (partialMatch && planRowToPostAll.has(partialMatch)) {
      return planRowToPostAll.get(partialMatch)
    }

    const fallback = allPlanRows.find((row) => normalize(row.workingTitle).indexOf(normalizedLabel.split(' ')[0]) >= 0)
    if (fallback && planRowToPostAll.has(fallback)) {
      return planRowToPostAll.get(fallback)
    }

    return null
  }

  const updates = []

  for (const row of planRowsWithPosts) {
    const post = planRowToPostAll.get(row)
    if (!post || !post.content) continue

    const initialContent = post.content
    let updatedContent = initialContent
    const linkTargets = extractLinkTargets(row.internalPlan)

    // Up link
    const explicitHub = linkTargets.up
      .map((label) => resolveTarget(label))
      .find(Boolean)
    const hub = explicitHub || pillarHub.get(row.pillar)
    if (hub && hub.slug !== post.slug) {
      const blockquote = `> This playbook pairs with our [${hub.title}](https://aistyleguide.com/blog/${hub.slug}); give that primer a skim if you want to see how the strategy, examples, and governance connect.`
      updatedContent = updatedContent
        .split('\n\n')
        .filter(
          (paragraph) =>
            !paragraph.startsWith('> This playbook pairs with our [') ||
            paragraph.includes(`/blog/${hub.slug}`)
        )
        .join('\n\n')
      if (!updatedContent.includes(`/blog/${hub.slug}`)) {
        const paragraphs = updatedContent.split('\n\n')
        if (paragraphs.length > 1) {
          paragraphs.splice(1, 0, blockquote)
          updatedContent = paragraphs.join('\n\n')
        } else {
          updatedContent = `${blockquote}\n\n${updatedContent}`
        }
      }
    }

    // Cross links
    const crossTargets = []
    for (const entry of linkTargets.cross) {
      const targetPost = resolveTarget(entry.label)
      if (!targetPost || targetPost.slug === post.slug) continue
      if (updatedContent.includes(`/blog/${targetPost.slug}`)) continue
      crossTargets.push({
        post: targetPost,
        anchor: entry.anchor,
      })
    }


    if (crossTargets.length) {
      const linkFragments = crossTargets.map(
        ({ post: target, anchor }) =>
          `[${anchor || target.title}](https://aistyleguide.com/blog/${target.slug})`
      )
      const sentence =
        sentenceWithLinks(pickCrossIntro(post.slug), linkFragments) + '.'

      if (updatedContent.includes('\n\n## Conclusion')) {
        updatedContent = updatedContent.replace(
          '\n\n## Conclusion',
          `\n\n${sentence}\n\n## Conclusion`
        )
      } else if (updatedContent.includes('\n\n---')) {
        updatedContent = updatedContent.replace('\n\n---', `\n\n${sentence}\n\n---`)
      } else {
        updatedContent = `${updatedContent.trim()}\n\n${sentence}\n`
      }
    }

    if (updatedContent !== initialContent) {
      updates.push({
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: updatedContent,
      })
    }
  }

  if (!updates.length) {
    console.log('No updates required.')
    return
  }

  for (const update of updates) {
    if (options.dryRun) {
      console.log(`[dry-run] Would update ${update.slug}`)
      continue
    }

    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({ content: update.content })
      .eq('id', update.id)

    if (updateError) {
      console.error(`Failed to update ${update.slug}: ${updateError.message}`)
    } else {
      console.log(`Updated ${update.slug}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

