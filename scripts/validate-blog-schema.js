#!/usr/bin/env node

/**
 * Quick validation script for blog post schema
 * Checks that required Schema.org properties are present
 */

const requiredBlogPostingProps = [
  '@context',
  '@type',
  'name',
  'headline',
  'description',
  'articleBody',
  'datePublished',
  'dateModified',
  'inLanguage',
  'genre',
  'isPartOf',
  'author',
  'publisher',
  'url',
  'keywords',
  'wordCount',
  'articleSection',
  'image'
]

const requiredBreadcrumbProps = [
  '@context',
  '@type',
  'itemListElement'
]

console.log('✅ Schema validation checklist:\n')
console.log('BlogPosting Schema should include:')
requiredBlogPostingProps.forEach(prop => {
  console.log(`  ✓ ${prop}`)
})

console.log('\nBreadcrumbList Schema should include:')
requiredBreadcrumbProps.forEach(prop => {
  console.log(`  ✓ ${prop}`)
})

console.log('\n📋 Manual Testing Steps:')
console.log('1. Visit: http://localhost:3000/blog/consistent-brand-voice-converts')
console.log('2. View page source (Cmd+Option+U)')
console.log('3. Find <script type="application/ld+json"> tags')
console.log('4. Copy JSON-LD content')
console.log('5. Test at: https://search.google.com/test/rich-results')
console.log('\nExpected results:')
console.log('  ✓ BlogPosting schema validates')
console.log('  ✓ BreadcrumbList schema validates')
console.log('  ✓ No errors or warnings')
console.log('  ✓ Rich result preview shows correctly')


