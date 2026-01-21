import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function findUser() {
  // Find a user with audits
  const { data: audits } = await supabase
    .from('brand_audit_runs')
    .select('user_id, domain')
    .eq('domain', 'justcancel.io')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (audits && audits.length > 0) {
    console.log('Found users with audits for justcancel.io:')
    audits.forEach((audit, i) => {
      console.log(`${i + 1}. User ID: ${audit.user_id}`)
    })
    console.log('\nUsing first user for test:',  audits[0].user_id)
  } else {
    console.log('No audits found for justcancel.io with user_id')
  }
}

findUser()
