#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEST_USER_ID = '288a2b04-4cfb-402a-96b0-7ba5a63a684c'
const DOMAIN = 'justcancel.io'

async function cleanup() {
  console.log('🧹 Cleaning up test data...')
  console.log(`User ID: ${TEST_USER_ID}`)
  console.log(`Domain: ${DOMAIN}`)

  // Get all audits for this user+domain
  const { data: audits } = await supabase
    .from('brand_audit_runs')
    .select('id')
    .eq('user_id', TEST_USER_ID)
    .eq('domain', DOMAIN)

  if (!audits || audits.length === 0) {
    console.log('\n✓ No audits found to clean up')
    return
  }

  console.log(`\nFound ${audits.length} audits to delete`)

  // Delete all issues for these audits
  const { error: issuesError, count: issuesCount } = await supabase
    .from('issues')
    .delete({ count: 'exact' })
    .in('audit_id', audits.map(a => a.id))

  if (issuesError) {
    console.error('❌ Error deleting issues:', issuesError)
  } else {
    console.log(`✓ Deleted ${issuesCount || 0} issues`)
  }

  // Delete all audits
  const { error: auditsError, count: auditsCount } = await supabase
    .from('brand_audit_runs')
    .delete({ count: 'exact' })
    .eq('user_id', TEST_USER_ID)
    .eq('domain', DOMAIN)

  if (auditsError) {
    console.error('❌ Error deleting audits:', auditsError)
  } else {
    console.log(`✓ Deleted ${auditsCount || 0} audits`)
  }

  console.log('\n✅ Cleanup complete!')
}

cleanup()
