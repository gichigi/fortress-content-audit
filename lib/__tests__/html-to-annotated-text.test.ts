/**
 * Tests for html-to-annotated-text converter.
 * Run with: npx tsx lib/__tests__/html-to-annotated-text.test.ts
 */

import { htmlToAnnotatedText, htmlToAnnotatedTextChunks } from '../html-to-annotated-text'

let passed = 0
let failed = 0

function expect(label: string, actual: string, test: (val: string) => boolean) {
  if (test(actual)) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    console.error(`    Got: ${actual.slice(0, 200)}`)
    failed++
  }
}

const testHtml = `
<html>
<head><title>Test Page</title></head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/pricing">Pricing</a>
  </nav>
  <header>
    <h1>Welcome to Our Site</h1>
    <p>We build great things.</p>
  </header>
  <main>
    <section>
      <h2>Features</h2>
      <p>Our product has amazing features.</p>
      <span class="badge">New</span>
      <span class="badge-pill">Beta</span>
    </section>
    <section>
      <h2>Pricing</h2>
      <p>Starting at $9/month.</p>
      <button>Get Started</button>
    </section>
  </main>
  <footer>
    <p>Copyright 2026</p>
    <a href="/privacy">Privacy</a>
  </footer>
</body>
</html>
`

console.log('\nhtmlToAnnotatedText()')

const result = htmlToAnnotatedText(testHtml, 'https://test.com')
console.log('\n--- Output ---')
console.log(result)
console.log('--- End ---\n')

expect('contains [NAV] prefix', result, v => v.includes('[NAV]'))
expect('contains [HEADER] prefix', result, v => v.includes('[HEADER]'))
expect('contains [H1] prefix', result, v => v.includes('[H1]'))
expect('contains [H2] prefix', result, v => v.includes('[H2]'))
expect('contains [P] prefix', result, v => v.includes('[P]'))
expect('contains [SECTION] prefix', result, v => v.includes('[SECTION]'))
expect('contains [FOOTER] prefix', result, v => v.includes('[FOOTER]'))
expect('contains [Badge: New]', result, v => v.includes('[Badge: New]'))
expect('contains [Badge: Beta]', result, v => v.includes('[Badge: Beta]'))
expect('contains button text', result, v => v.includes('[Button:') || v.includes('Get Started'))
expect('does not contain <script>', result, v => !v.includes('<script>'))
expect('does not contain <nav>', result, v => !v.includes('<nav>'))

// Hidden element test
const hiddenHtml = `
<body>
  <p>Visible text</p>
  <span class="hidden">Hidden text</span>
  <span class="sr-only">Screen reader only</span>
  <div class="hidden md:flex">Responsive nav</div>
  <p>More visible text</p>
</body>
`
const hiddenResult = htmlToAnnotatedText(hiddenHtml, 'https://test.com')
expect('removes hidden spans', hiddenResult, v => !v.includes('Hidden text'))
expect('removes sr-only spans', hiddenResult, v => !v.includes('Screen reader only'))
expect('keeps responsive-show elements', hiddenResult, v => v.includes('Responsive nav'))
expect('keeps visible text', hiddenResult, v => v.includes('Visible text'))

// Token reduction test
expect('output is shorter than input (compression)', result, v => v.length < testHtml.length)
const ratio = result.length / testHtml.length
console.log(`\nCompression ratio: ${(ratio * 100).toFixed(1)}% of original (${testHtml.length} -> ${result.length} chars)`)

// Chunking test
console.log('\nhtmlToAnnotatedTextChunks()')
const smallChunks = htmlToAnnotatedTextChunks(testHtml, 'https://test.com', 100)
expect('chunks when over limit', smallChunks, v => v.length > 1)
expect('each chunk under limit', smallChunks, v => v.every(c => c.length <= 120)) // small buffer OK

const bigChunks = htmlToAnnotatedTextChunks(testHtml, 'https://test.com', 50000)
expect('single chunk when under limit', bigChunks, v => v.length === 1)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
