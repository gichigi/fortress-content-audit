import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSchema() {
  const { data, error } = await supabase
    .from('brand_audit_runs')
    .select('*')
    .eq('id', '84d7fdd7-56f7-477c-a977-bc708328ba12')
    .single()

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Audit columns:', Object.keys(data))
    console.log('\nFull data:', JSON.stringify(data, null, 2))
  }
}

checkSchema()
