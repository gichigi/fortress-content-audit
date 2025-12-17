/**
 * Migration script to extract instances from existing issues_json and populate audit_issues table
 * 
 * Run this script if you have existing audit data that needs to be migrated.
 * 
 * Usage:
 *   npx tsx scripts/migrate-issues-to-instances.ts
 * 
 * Or with environment variables:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-issues-to-instances.ts
 */

import { createClient } from '@supabase/supabase-js'
import { deriveCategory } from '../lib/audit-table-adapter'
import { generateInstanceSignature } from '../lib/issue-signature'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface AuditGroup {
  title: string
  severity: 'low' | 'medium' | 'high'
  impact: string
  fix: string
  examples: Array<{ url: string; snippet: string }>
  count: number
}

async function migrateIssuesToInstances() {
  console.log('Starting migration of issues_json to audit_issues table...\n')

  // Fetch all audits with issues_json
  const { data: audits, error: fetchError } = await supabase
    .from('brand_audit_runs')
    .select('id, issues_json')
    .not('issues_json', 'is', null)

  if (fetchError) {
    console.error('Error fetching audits:', fetchError)
    process.exit(1)
  }

  if (!audits || audits.length === 0) {
    console.log('No audits found with issues_json. Nothing to migrate.')
    return
  }

  console.log(`Found ${audits.length} audits to migrate\n`)

  let totalInstances = 0
  let successCount = 0
  let errorCount = 0

  for (const audit of audits) {
    const issuesJson = audit.issues_json as any
    const groups = Array.isArray(issuesJson?.groups) ? issuesJson.groups : []

    if (groups.length === 0) {
      console.log(`Skipping audit ${audit.id} - no groups found`)
      continue
    }

    console.log(`Processing audit ${audit.id} (${groups.length} groups)...`)

    const instancesToInsert: any[] = []

    for (const group of groups as AuditGroup[]) {
      const category = deriveCategory(group.title)

      for (const example of group.examples || []) {
        const signature = generateInstanceSignature({
          url: example.url,
          title: group.title,
          snippet: example.snippet,
        })

        instancesToInsert.push({
          audit_id: audit.id,
          category,
          severity: group.severity,
          title: group.title,
          url: example.url,
          snippet: example.snippet,
          impact: group.impact || null,
          fix: group.fix || null,
          signature,
        })
      }
    }

    if (instancesToInsert.length === 0) {
      console.log(`  No instances to insert for audit ${audit.id}`)
      continue
    }

    // Insert instances in batches of 100
    const batchSize = 100
    for (let i = 0; i < instancesToInsert.length; i += batchSize) {
      const batch = instancesToInsert.slice(i, i + batchSize)
      
      const { error: insertError } = await (supabase as any)
        .from('audit_issues')
        .insert(batch)

      if (insertError) {
        console.error(`  Error inserting batch for audit ${audit.id}:`, insertError)
        errorCount++
      } else {
        console.log(`  Inserted ${batch.length} instances (batch ${Math.floor(i / batchSize) + 1})`)
        totalInstances += batch.length
        successCount++
      }
    }

    console.log(`  Completed audit ${audit.id}: ${instancesToInsert.length} instances\n`)
  }

  console.log('\n=== Migration Summary ===')
  console.log(`Total audits processed: ${audits.length}`)
  console.log(`Total instances inserted: ${totalInstances}`)
  console.log(`Successful batches: ${successCount}`)
  console.log(`Failed batches: ${errorCount}`)
  console.log('\nMigration complete!')
}

// Run migration
migrateIssuesToInstances()
  .then(() => {
    console.log('\nMigration script finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error)
    process.exit(1)
  })

