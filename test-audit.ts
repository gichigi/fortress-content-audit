#!/usr/bin/env tsx
/**
 * Test script for audit function
 * Tests the new prompt format integration
 */

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '.env.local') })

import { miniAudit } from './lib/audit'

async function testAudit() {
  const domain = 'justcancel.io'
  
  console.log(`\n🧪 Testing audit for ${domain}...\n`)
  
  try {
    const result = await miniAudit(domain)
    
    console.log('✅ Audit completed successfully!\n')
    console.log('Results:')
    console.log(`- Total issues: ${result.issues.length}`)
    console.log(`- Pages audited: ${result.pagesAudited}`)
    console.log(`- Status: ${result.status}`)
    console.log(`- Duration: ${result.modelDurationMs}ms\n`)
    
    if (result.issues.length > 0) {
      console.log('Sample issues:')
      result.issues.slice(0, 3).forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.issue_description}`)
        console.log(`   Category: ${issue.category}`)
        console.log(`   Severity: ${issue.severity}`)
        console.log(`   Page: ${issue.page_url}`)
        console.log(`   Fix: ${issue.suggested_fix}`)
      })
    } else {
      console.log('No issues found.')
    }
    
    console.log('\n✅ Test completed successfully!')
  } catch (error) {
    console.error('\n❌ Test failed:')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

testAudit()

