import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkIssues() {
  // Get the most recent audit for justcancel.io
  const { data: audits } = await supabase
    .from('brand_audit_runs')
    .select('id')
    .eq('domain', 'justcancel.io')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!audits?.length) {
    console.log('No audits found')
    return
  }

  const auditId = audits[0].id
  console.log('Latest audit ID:', auditId)

  // Get all issues for this audit
  const { data: issues } = await supabase
    .from('issues')
    .select('id, category, status, issue_description')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })

  console.log(`\nTotal issues: ${issues?.length || 0}`)
  
  if (issues) {
    const statusCounts = issues.reduce((acc, issue) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\nStatus breakdown:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })

    console.log('\nAll issues:')
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.status}] ${issue.issue_description.substring(0, 70)}...`)
    })
  }
}

checkIssues()
