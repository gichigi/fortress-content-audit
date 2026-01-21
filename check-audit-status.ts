import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAudit() {
  const { data, error } = await supabase
    .from('brand_audit_runs')
    .select('id, status, pages_audited')
    .eq('id', '84d7fdd7-56f7-477c-a977-bc708328ba12')
    .single()

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Audit status:', JSON.stringify(data, null, 2))
  }

  // Also check issues
  const { data: issues } = await supabase
    .from('issues')
    .select('id, category, status')
    .eq('audit_id', '84d7fdd7-56f7-477c-a977-bc708328ba12')

  console.log(`\nIssues found: ${issues?.length || 0}`)
  if (issues) {
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.category}] status: ${issue.status}`)
    })
  }
}

checkAudit()
