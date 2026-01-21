import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function compareAudits() {
  const AUDIT_1 = '8b95cb1b-54eb-428b-a6de-de60ea9f2d65'
  const AUDIT_2 = '31378a72-90b3-46cd-9b00-5eb8a0bc4499'

  const { data: issues1 } = await supabase
    .from('issues')
    .select('category, issue_description')
    .eq('audit_id', AUDIT_1)

  const { data: issues2 } = await supabase
    .from('issues')
    .select('category, issue_description')
    .eq('audit_id', AUDIT_2)

  console.log('AUDIT 1 (4 issues, all marked resolved/ignored):')
  issues1?.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.category}] ${issue.issue_description.substring(0, 80)}...`)
  })

  console.log('\nAUDIT 2 (7 issues):')
  issues2?.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.category}] ${issue.issue_description.substring(0, 80)}...`)
  })

  // Check for overlaps
  console.log('\n\n🔍 CHECKING FOR OVERLAPS:')
  const descriptions1 = new Set(issues1?.map(i => i.issue_description))
  const overlaps = issues2?.filter(issue => descriptions1.has(issue.issue_description))

  if (overlaps && overlaps.length > 0) {
    console.log(`\n❌ Found ${overlaps.length} issues that appeared in BOTH audits:`)
    overlaps.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.issue_description.substring(0, 80)}...`)
    })
  } else {
    console.log('\n✅ NO overlaps - all issues in audit 2 are different from audit 1')
  }
}

compareAudits()
