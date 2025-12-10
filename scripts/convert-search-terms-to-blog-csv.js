#!/usr/bin/env node

/**
 * Convert Google Ads Search Terms CSV to Blog Topics CSV
 * 
 * Usage: node scripts/convert-search-terms-to-blog-csv.js [input.csv] [output.csv]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments
const inputPath = process.argv[2] || '/Users/tahi/Downloads/Search terms report.csv'
const outputPath = process.argv[3] || path.join(__dirname, 'blog-topics-from-search-terms.csv')

console.log('🔄 Converting Google Ads search terms to blog topics CSV...')
console.log(`📥 Input: ${inputPath}`)
console.log(`📤 Output: ${outputPath}\n`)

// Check if input file exists
if (!fs.existsSync(inputPath)) {
  console.error(`❌ Input file not found: ${inputPath}`)
  process.exit(1)
}

// Read input CSV
const csvContent = fs.readFileSync(inputPath, 'utf-8')
const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)

// Skip first 3 rows (title, date range, headers)
if (lines.length < 4) {
  console.error('❌ CSV file is too short or missing header rows')
  process.exit(1)
}

// Parse header row to get column indices
const headerRow = lines[2] // Row 3 (0-indexed: 2)
const headers = headerRow.split(',').map(h => h.trim())

const searchTermIndex = headers.indexOf('Search term')
const excludedIndex = headers.indexOf('Added/Excluded')
const clicksIndex = headers.indexOf('Clicks')
const impressionsIndex = headers.indexOf('Impr.')

if (searchTermIndex === -1) {
  console.error('❌ Could not find "Search term" column in CSV')
  process.exit(1)
}

console.log(`📊 Found columns:`)
console.log(`   - Search term: column ${searchTermIndex}`)
console.log(`   - Added/Excluded: column ${excludedIndex >= 0 ? excludedIndex : 'not found'}`)
console.log(`   - Clicks: column ${clicksIndex >= 0 ? clicksIndex : 'not found'}`)
console.log(`   - Impressions: column ${impressionsIndex >= 0 ? impressionsIndex : 'not found'}\n`)

// Process data rows (skip first 3 rows)
const dataRows = lines.slice(3)
const seenTerms = new Map() // Map<lowercase_term, {title, keywords, impressions}>
const blogTopics = []

let processed = 0
let excluded = 0
let duplicates = 0
let empty = 0

for (const row of dataRows) {
  // Skip total rows (they start with "Total:")
  if (row.startsWith('Total:')) {
    continue
  }

  // Parse CSV row (handle quoted fields with commas)
  const values = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim()) // Add last value

  // Extract search term
  const searchTerm = values[searchTermIndex]?.trim()
  
  if (!searchTerm || searchTerm === '') {
    empty++
    continue
  }

  // Check if excluded
  if (excludedIndex >= 0) {
    const excludedValue = values[excludedIndex]?.trim()
    if (excludedValue === 'Excluded') {
      excluded++
      continue
    }
  }

  // Extract impressions (remove commas and parse as integer)
  let impressions = 0
  if (impressionsIndex >= 0 && values[impressionsIndex]) {
    const impStr = values[impressionsIndex].replace(/,/g, '').trim()
    impressions = parseInt(impStr, 10) || 0
  }

  // Handle duplicates (case-insensitive) - sum impressions
  const searchTermLower = searchTerm.toLowerCase()
  if (seenTerms.has(searchTermLower)) {
    // Sum impressions for duplicate terms
    const existing = seenTerms.get(searchTermLower)
    existing.impressions += impressions
    duplicates++
    continue
  }

  // Create title (capitalize first letter)
  const title = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)

  // Create keywords: use the search term itself + related terms
  // Split multi-word terms into individual keywords
  const keywords = [
    searchTerm,
    ...searchTerm.split(/\s+/).filter(word => word.length > 2)
  ].join(', ')

  seenTerms.set(searchTermLower, {
    title,
    keywords,
    category: 'Brand Strategy',
    impressions
  })

  processed++
}

// Convert map to array and sort by impressions (descending)
for (const [key, topic] of seenTerms.entries()) {
  blogTopics.push(topic)
}

// Sort by impressions descending (highest first)
blogTopics.sort((a, b) => b.impressions - a.impressions)

// Generate output CSV
const outputLines = ['title,keywords,category']

for (const topic of blogTopics) {
  // Escape quotes in title and keywords
  const escapedTitle = topic.title.replace(/"/g, '""')
  const escapedKeywords = topic.keywords.replace(/"/g, '""')
  
  outputLines.push(`"${escapedTitle}","${escapedKeywords}","${topic.category}"`)
}

// Write output file
fs.writeFileSync(outputPath, outputLines.join('\n') + '\n', 'utf-8')

// Print summary
console.log('✅ Conversion complete!\n')
console.log('📊 Summary:')
console.log(`   ✅ Processed: ${blogTopics.length} unique search terms`)
console.log(`   ⚠️  Excluded: ${excluded} terms`)
console.log(`   ⚠️  Duplicates merged: ${duplicates} terms (impressions summed)`)
console.log(`   ⚠️  Empty: ${empty} rows`)
console.log(`\n📈 Top 10 by impressions:`)
blogTopics.slice(0, 10).forEach((topic, i) => {
  console.log(`   ${i + 1}. "${topic.title}" - ${topic.impressions} impressions`)
})
console.log(`\n📄 Output saved to: ${outputPath}`)
console.log(`   (Sorted by impressions, highest first)`)
console.log(`\n💡 Next steps:`)
console.log(`   1. Review the output CSV file`)
console.log(`   2. Test with: pnpm run generate-blog:dry --csv="${outputPath}" --limit=3`)
console.log(`   3. Generate all: pnpm run generate-blog --csv="${outputPath}"`)
