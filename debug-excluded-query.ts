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

async function debugExcludedQuery() {
  // Step 1: Get all audits for this user+domain
  const { data: audits, error: auditsError } = await supabase
    .from('brand_audit_runs')
    .select('id')
    .eq('user_id', TEST_USER_ID)
    .eq('domain', DOMAIN)

  console.log('Step 1: Get audits')
  console.log('  Error:', auditsError)
  console.log('  Audits found:', audits?.length || 0)
  console.log('  Audit IDs:', audits?.map(a => a.id))

  if (!audits?.length) {
    console.log('\n❌ No audits found for user+domain')
    return
  }

  // Step 2: Get resolved/ignored issues
  const { data: issues, error: issuesError } = await supabase
    .from('issues')
    .select('page_url, category, issue_description, status, audit_id')
    .in('audit_id', audits.map(a => a.id))
    .in('status', ['resolved', 'ignored'])
    .order('updated_at', { ascending: false })
    .limit(50)

  console.log('\nStep 2: Get excluded issues')
  console.log('  Error:', issuesError)
  console.log('  Issues found:', issues?.length || 0)
  
  if (issues) {
    console.log('\n  Details:')
    issues.forEach((issue, i) => {
      console.log(`    ${i + 1}. [${issue.status}] audit: ${issue.audit_id.substring(0, 8)}... - ${issue.issue_description.substring(0, 60)}...`)
    })
  }

  // Step 3: Check if there's a user_id mismatch
  console.log('\n\nStep 3: Check audit ownership')
  const { data: auditDetails } = await supabase
    .from('brand_audit_runs')
    .select('id, user_id, domain')
    .eq('domain', DOMAIN)
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('Recent audits for domain:')
  auditDetails?.forEach((audit, i) => {
    console.log(`  ${i + 1}. ID: ${audit.id.substring(0, 8)}... user_id: ${audit.user_id || 'NULL'}`)
  })
}

debugExcludedQuery()
