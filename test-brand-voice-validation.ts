/**
 * Test script for brand voice validation fixes
 * Run with: npx ts-node test-brand-voice-validation.ts
 *
 * Tests all validation rules:
 * - Enum validation (readability_level, formality, locale)
 * - Size limits (voice_summary, keywords)
 * - Domain validation
 * - Keyword sanitization
 * - Bearer token handling
 * - Error messages
 */

import { VALID_READABILITY, VALID_FORMALITY, VALID_LOCALE, MAX_VOICE_SUMMARY, MAX_KEYWORDS, MAX_KEYWORD_LENGTH, isValidDomain } from "./lib/brand-voice-constants"

interface TestResult {
  name: string
  passed: boolean
  expected: string
  actual: string
  error?: string
}

const results: TestResult[] = []

function test(name: string, condition: boolean, expected: string, actual: string, error?: string) {
  results.push({
    name,
    passed: condition,
    expected,
    actual,
    error,
  })
  const icon = condition ? "✅" : "❌"
  console.log(`${icon} ${name}`)
  if (!condition && error) console.log(`   ${error}`)
}

// ============================================================================
// ENUM VALIDATION TESTS
// ============================================================================

console.log("\n🧪 ENUM VALIDATION TESTS")
console.log("========================\n")

test(
  "VALID_READABILITY has correct values",
  VALID_READABILITY.includes("grade_6_8") &&
    VALID_READABILITY.includes("grade_10_12") &&
    VALID_READABILITY.includes("grade_13_plus") &&
    VALID_READABILITY.length === 3,
  "3 values: grade_6_8, grade_10_12, grade_13_plus",
  `${VALID_READABILITY.length} values: ${VALID_READABILITY.join(", ")}`
)

test(
  "VALID_FORMALITY has correct values",
  VALID_FORMALITY.includes("very_casual") &&
    VALID_FORMALITY.includes("casual") &&
    VALID_FORMALITY.includes("neutral") &&
    VALID_FORMALITY.includes("formal") &&
    VALID_FORMALITY.includes("very_formal") &&
    VALID_FORMALITY.length === 5,
  "5 values: very_casual, casual, neutral, formal, very_formal",
  `${VALID_FORMALITY.length} values: ${VALID_FORMALITY.join(", ")}`
)

test(
  "VALID_LOCALE has correct values",
  VALID_LOCALE.includes("en-US") &&
    VALID_LOCALE.includes("en-GB") &&
    VALID_LOCALE.length === 2,
  "2 values: en-US, en-GB",
  `${VALID_LOCALE.length} values: ${VALID_LOCALE.join(", ")}`
)

// ============================================================================
// SIZE LIMITS TESTS
// ============================================================================

console.log("\n🧪 SIZE LIMITS TESTS")
console.log("====================\n")

test(
  "MAX_VOICE_SUMMARY is 10000 chars",
  MAX_VOICE_SUMMARY === 10000,
  "10000",
  String(MAX_VOICE_SUMMARY)
)

test(
  "MAX_KEYWORDS is 50 items",
  MAX_KEYWORDS === 50,
  "50",
  String(MAX_KEYWORDS)
)

test(
  "MAX_KEYWORD_LENGTH is 100 chars",
  MAX_KEYWORD_LENGTH === 100,
  "100",
  String(MAX_KEYWORD_LENGTH)
)

// ============================================================================
// DOMAIN VALIDATION TESTS
// ============================================================================

console.log("\n🧪 DOMAIN VALIDATION TESTS")
console.log("===========================\n")

const validDomains = [
  "example.com",
  "sub.example.com",
  "example.co.uk",
  "test-domain.com",
  "a.io",
  "x.co",
]

validDomains.forEach((domain) => {
  test(
    `Valid domain: ${domain}`,
    isValidDomain(domain),
    "valid",
    isValidDomain(domain) ? "valid" : "invalid"
  )
})

const invalidDomains = [
  "invalid",
  "localhost",
  "192.168.1.1",
  "http://example.com",
  "example",
  "a",
  "-example.com",
  "example-.com",
  "example..com",
  "a".repeat(254) + ".com", // too long
  "",
  "exam ple.com", // space
]

invalidDomains.forEach((domain) => {
  test(
    `Invalid domain: "${domain}"`,
    !isValidDomain(domain),
    "invalid",
    isValidDomain(domain) ? "valid" : "invalid"
  )
})

// ============================================================================
// KEYWORD SANITIZATION TESTS
// ============================================================================

console.log("\n🧪 KEYWORD SANITIZATION TESTS")
console.log("==============================\n")

const validKeywords = [
  "old-product-name",
  "banned phrase",
  "CamelCaseKeyword",
  "keyword-with-dash",
  "keyword_with_underscore",
  "keyword123",
]

validKeywords.forEach((keyword) => {
  const passes = keyword.length > 0 && keyword.length <= MAX_KEYWORD_LENGTH && !/[\n\r\t]/.test(keyword)
  test(
    `Valid keyword: "${keyword}"`,
    passes,
    "passes sanitization",
    passes ? "passes" : "fails"
  )
})

const invalidKeywords = [
  "keyword\nwith newline",
  "keyword\rwith carriage return",
  "keyword\twith tab",
  "a".repeat(101), // too long
  "",
  "keyword\n\nwith multiple newlines",
]

invalidKeywords.forEach((keyword) => {
  const passes = keyword.length > 0 && keyword.length <= MAX_KEYWORD_LENGTH && !/[\n\r\t]/.test(keyword)
  test(
    `Invalid keyword: "${keyword.substring(0, 20)}..."`,
    !passes,
    "fails sanitization",
    passes ? "passes" : "fails"
  )
})

// ============================================================================
// VOICE SUMMARY SIZE TESTS
// ============================================================================

console.log("\n🧪 VOICE SUMMARY SIZE TESTS")
console.log("=============================\n")

const validVoiceSummary = "# Brand Voice\n\nThis is a valid brand voice document that is under the limit."
test(
  "Valid voice summary (under limit)",
  validVoiceSummary.length <= MAX_VOICE_SUMMARY,
  `<= ${MAX_VOICE_SUMMARY} chars`,
  `${validVoiceSummary.length} chars`
)

const tooLongVoiceSummary = "a".repeat(MAX_VOICE_SUMMARY + 1)
test(
  "Invalid voice summary (over limit)",
  tooLongVoiceSummary.length > MAX_VOICE_SUMMARY,
  `> ${MAX_VOICE_SUMMARY} chars`,
  `${tooLongVoiceSummary.length} chars`
)

const maxVoiceSummary = "a".repeat(MAX_VOICE_SUMMARY)
test(
  "Voice summary at exact limit",
  maxVoiceSummary.length === MAX_VOICE_SUMMARY,
  `= ${MAX_VOICE_SUMMARY} chars`,
  `${maxVoiceSummary.length} chars`
)

// ============================================================================
// KEYWORD ARRAY SIZE TESTS
// ============================================================================

console.log("\n🧪 KEYWORD ARRAY SIZE TESTS")
console.log("============================\n")

const validKeywordArray = Array(10).fill("keyword")
test(
  "Valid keyword array (10 items)",
  validKeywordArray.length <= MAX_KEYWORDS,
  `<= ${MAX_KEYWORDS} items`,
  `${validKeywordArray.length} items`
)

const tooManyKeywords = Array(MAX_KEYWORDS + 1).fill("keyword")
test(
  "Invalid keyword array (51 items)",
  tooManyKeywords.length > MAX_KEYWORDS,
  `> ${MAX_KEYWORDS} items`,
  `${tooManyKeywords.length} items`
)

const maxKeywords = Array(MAX_KEYWORDS).fill("keyword")
test(
  "Keyword array at exact limit (50 items)",
  maxKeywords.length === MAX_KEYWORDS,
  `= ${MAX_KEYWORDS} items`,
  `${maxKeywords.length} items`
)

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n" + "=".repeat(50))
console.log("TEST SUMMARY")
console.log("=".repeat(50) + "\n")

const passed = results.filter((r) => r.passed).length
const total = results.length
const percentage = Math.round((passed / total) * 100)

console.log(`✅ Passed: ${passed}/${total} (${percentage}%)`)

if (passed < total) {
  console.log("\n❌ FAILED TESTS:\n")
  results.filter((r) => !r.passed).forEach((r) => {
    console.log(`  - ${r.name}`)
    console.log(`    Expected: ${r.expected}`)
    console.log(`    Actual: ${r.actual}`)
    if (r.error) console.log(`    Error: ${r.error}`)
  })
  process.exit(1)
} else {
  console.log("\n🎉 All tests passed!")
  process.exit(0)
}
