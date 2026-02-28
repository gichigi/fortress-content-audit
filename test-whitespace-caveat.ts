#!/usr/bin/env npx tsx

/**
 * Unit tests for whitespace false-positive caveat in audit prompts.
 * Validates that all three prompt builders include the extraction artifact
 * warning and that prompt structure remains intact.
 */

import { buildMiniAuditPrompt, buildFullAuditPrompt, buildCategoryAuditPrompt } from './lib/audit-prompts'

const CAVEAT_MARKER = 'IMPORTANT — Markdown extraction artifacts'
const CAVEAT_PHRASES = [
  'strips whitespace between adjacent HTML elements',
  'DO NOT flag spacing issues that look like HTML elements merged together',
  'Do not flag mailto: links, tel: links, or external links as broken',
  'Only flag internal navigation links',
]

// Artifact examples that should be in the caveat
const ARTIFACT_EXAMPLES = [
  'Thesimple',
  'Add to your websiteA',
  '3000events',
  'people.But',
]

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}`)
    failed++
  }
}

// --- Test buildMiniAuditPrompt ---
console.log('\n📋 buildMiniAuditPrompt')

const miniPrompt = buildMiniAuditPrompt(
  'https://seline.so',
  '<!-- manifest -->',
  '[]',
  '[]'
)

assert(miniPrompt.includes(CAVEAT_MARKER), 'Contains caveat header')
for (const phrase of CAVEAT_PHRASES) {
  assert(miniPrompt.includes(phrase), `Contains: "${phrase.slice(0, 50)}..."`)
}
for (const example of ARTIFACT_EXAMPLES) {
  assert(miniPrompt.includes(`"${example}"`), `Contains example: "${example}"`)
}
// Structural checks - caveat should be AFTER language detection, BEFORE manifest instructions
const langDetIdx = miniPrompt.indexOf('Language detection:')
const caveatIdx = miniPrompt.indexOf(CAVEAT_MARKER)
const manifestIdx = miniPrompt.indexOf('HOW TO USE THE MANIFEST:')
assert(langDetIdx < caveatIdx, 'Caveat is after language detection')
assert(caveatIdx < manifestIdx, 'Caveat is before manifest instructions')
// Make sure the rest of the prompt is still intact
assert(miniPrompt.includes('BOT_PROTECTION_OR_FIREWALL_BLOCKED'), 'Bot protection instruction intact')
assert(miniPrompt.includes('# Output Format'), 'Output format section intact')
assert(miniPrompt.includes('"severity"'), 'Severity field intact')

// --- Test buildFullAuditPrompt ---
console.log('\n📋 buildFullAuditPrompt')

const fullPrompt = buildFullAuditPrompt(
  'https://seline.so',
  '<!-- manifest -->',
  '[]',
  '[]',
  false
)

assert(fullPrompt.includes(CAVEAT_MARKER), 'Contains caveat header')
for (const phrase of CAVEAT_PHRASES) {
  assert(fullPrompt.includes(phrase), `Contains: "${phrase.slice(0, 50)}..."`)
}
for (const example of ARTIFACT_EXAMPLES) {
  assert(fullPrompt.includes(`"${example}"`), `Contains example: "${example}"`)
}
const fullLangIdx = fullPrompt.indexOf('Language detection:')
const fullCaveatIdx = fullPrompt.indexOf(CAVEAT_MARKER)
const fullManifestIdx = fullPrompt.indexOf('HOW TO USE THE MANIFEST:')
assert(fullLangIdx < fullCaveatIdx, 'Caveat is after language detection')
assert(fullCaveatIdx < fullManifestIdx, 'Caveat is before manifest instructions')
assert(fullPrompt.includes('Audit up to 20 public-facing'), 'Full audit scope instruction intact')
assert(fullPrompt.includes('Avoid long-form blog'), 'Longform filter intact (default false)')

// Test with longform enabled
const fullPromptLongform = buildFullAuditPrompt('https://seline.so', '', '[]', '[]', true)
assert(fullPromptLongform.includes(CAVEAT_MARKER), 'Caveat present with longform=true')
assert(!fullPromptLongform.includes('Avoid long-form blog'), 'Longform filter excluded when true')

// --- Test buildCategoryAuditPrompt (all 3 categories) ---
const categories: Array<"Language" | "Facts & Consistency" | "Links & Formatting"> = [
  "Language",
  "Facts & Consistency",
  "Links & Formatting"
]

for (const category of categories) {
  console.log(`\n📋 buildCategoryAuditPrompt("${category}")`)

  const catPrompt = buildCategoryAuditPrompt(
    category,
    ['https://seline.so', 'https://seline.so/pricing'],
    '<!-- manifest -->',
    '[]',
    '[]'
  )

  assert(catPrompt.includes(CAVEAT_MARKER), 'Contains caveat header')
  for (const phrase of CAVEAT_PHRASES) {
    assert(catPrompt.includes(phrase), `Contains: "${phrase.slice(0, 50)}..."`)
  }

  const catLangIdx = catPrompt.indexOf('Language detection:')
  const catCaveatIdx = catPrompt.indexOf(CAVEAT_MARKER)
  assert(catLangIdx < catCaveatIdx, 'Caveat is after language detection')

  // Category-specific instructions should still be present
  if (category === 'Language') {
    assert(catPrompt.includes('Typos and misspellings'), 'Language instructions intact')
  } else if (category === 'Facts & Consistency') {
    assert(catPrompt.includes('Factual errors'), 'Facts instructions intact')
  } else {
    assert(catPrompt.includes('Formatting & UX'), 'Links/Formatting instructions intact')
  }
}

// --- Test Links & Formatting category has mailto exclusion ---
console.log('\n📋 buildCategoryAuditPrompt("Links & Formatting") mailto exclusion')

const linksPrompt = buildCategoryAuditPrompt(
  'Links & Formatting',
  ['https://seline.so'],
  '<!-- manifest -->',
  '[]',
  '[]'
)
assert(linksPrompt.includes('DO NOT flag mailto: links, tel: links, or external links as broken or non-functional'), 'Links category: has mailto/tel/external exclusion')
assert(linksPrompt.includes('you cannot verify these from markdown'), 'Links category: explains why')
assert(!linksPrompt.includes('Test ALL links'), 'Links category: does NOT say test ALL links')

// Mini and Full prompts should also exclude mailto/tel/external
assert(miniPrompt.includes('not mailto/tel/external'), 'Mini: category description excludes mailto/tel/external')
assert(fullPrompt.includes('not mailto/tel/external'), 'Full: category description excludes mailto/tel/external')
assert(miniPrompt.includes('Test internal navigation links'), 'Mini: says test internal links only')
assert(fullPrompt.includes('Test internal navigation links'), 'Full: says test internal links only')

// --- Test with ignore/flag keywords ---
console.log('\n📋 buildCategoryAuditPrompt with ignore/flag keywords')

const catWithKeywords = buildCategoryAuditPrompt(
  'Language',
  ['https://seline.so'],
  '',
  '[]',
  '[]',
  ['Seline', 'SELINEbot'],
  ['utilize', 'synergy']
)

assert(catWithKeywords.includes(CAVEAT_MARKER), 'Caveat present with keywords')
assert(catWithKeywords.includes('Seline'), 'Ignore keywords intact')
assert(catWithKeywords.includes('utilize'), 'Flag keywords intact')

// --- Test with excluded/active issues ---
console.log('\n📋 Prompts with excluded/active issues')

const miniWithIssues = buildMiniAuditPrompt(
  'https://seline.so',
  '',
  '[{"id": "1", "desc": "old issue"}]',
  '[{"id": "2", "desc": "active issue"}]'
)
assert(miniWithIssues.includes(CAVEAT_MARKER), 'Mini: caveat present with issues')
assert(miniWithIssues.includes('Previously Resolved'), 'Mini: excluded issues section intact')
assert(miniWithIssues.includes('Active Issues'), 'Mini: active issues section intact')

const fullWithIssues = buildFullAuditPrompt(
  'https://seline.so',
  '',
  '[{"id": "1", "desc": "old issue"}]',
  '[{"id": "2", "desc": "active issue"}]'
)
assert(fullWithIssues.includes(CAVEAT_MARKER), 'Full: caveat present with issues')
assert(fullWithIssues.includes('Previously Resolved'), 'Full: excluded issues section intact')
assert(fullWithIssues.includes('Active Issues'), 'Full: active issues section intact')

// --- Summary ---
console.log(`\n${'='.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`)
if (failed > 0) {
  console.log('❌ SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('✅ ALL TESTS PASSED')
}
