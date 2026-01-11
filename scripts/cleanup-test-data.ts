// Cleanup script to delete all test users and data
// WARNING: This deletes ALL users and data. Use only for test environments.

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load env vars
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const stripeSecretKey = process.env.STRIPE_TEST_SECRET_KEY!

if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-03-31.basil',
})

async function cleanupStripe() {
  console.log('🧹 Cleaning up Stripe...')
  
  // Cancel all subscriptions
  console.log('  Cancelling subscriptions...')
  const subscriptions = await stripe.subscriptions.list({ limit: 100 })
  for (const sub of subscriptions.data) {
    try {
      await stripe.subscriptions.cancel(sub.id)
      console.log(`    ✅ Cancelled subscription: ${sub.id}`)
    } catch (error: any) {
      console.log(`    ⚠️  Error cancelling ${sub.id}: ${error.message}`)
    }
  }
  
  // Delete all customers
  console.log('  Deleting customers...')
  const customers = await stripe.customers.list({ limit: 100 })
  for (const customer of customers.data) {
    try {
      await stripe.customers.del(customer.id)
      console.log(`    ✅ Deleted customer: ${customer.id} (${customer.email || 'no email'})`)
    } catch (error: any) {
      console.log(`    ⚠️  Error deleting ${customer.id}: ${error.message}`)
    }
  }
  
  console.log('✅ Stripe cleanup complete\n')
}

async function cleanupSupabase() {
  console.log('🧹 Cleaning up Supabase...')
  
  // List all users
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }
  
  if (!usersData?.users || usersData.users.length === 0) {
    console.log('  No users found')
    return
  }
  
  console.log(`  Found ${usersData.users.length} users`)
  
  // Delete related data first (to avoid foreign key constraints)
  console.log('  Deleting user-related data...')
  
  for (const user of usersData.users) {
    try {
      // Get audit IDs first
      const { data: audits } = await supabase
        .from('brand_audit_runs')
        .select('id')
        .eq('user_id', user.id)
      
      const auditIds = audits?.map(a => a.id) || []
      
      // Delete issues (if any audits exist)
      if (auditIds.length > 0) {
        await supabase.from('issues').delete().in('audit_id', auditIds)
      }
      
      // Delete audit usage
      await supabase.from('audit_usage').delete().eq('user_id', user.id)
      
      // Delete audit issue states
      await supabase.from('audit_issue_states').delete().eq('user_id', user.id)
      
      // Delete brand audit runs
      await supabase.from('brand_audit_runs').delete().eq('user_id', user.id)
      
      // Delete scheduled audits
      await supabase.from('scheduled_audits').delete().eq('user_id', user.id)
      
      // Delete email captures
      if (user.email) {
        await supabase.from('email_captures').delete().eq('email', user.email)
      }
      
      // Delete profiles
      await supabase.from('profiles').delete().eq('user_id', user.id)
      
      console.log(`    ✅ Cleaned data for: ${user.email || user.id}`)
    } catch (error: any) {
      console.log(`    ⚠️  Error cleaning data for ${user.id}: ${error.message}`)
    }
  }
  
  // Now delete auth users
  console.log('  Deleting auth users...')
  for (const user of usersData.users) {
    try {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.log(`    ⚠️  Error deleting user ${user.id} (${user.email}): ${deleteError.message}`)
      } else {
        console.log(`    ✅ Deleted user: ${user.email || user.id}`)
      }
    } catch (error: any) {
      console.log(`    ⚠️  Error deleting user ${user.id}: ${error.message}`)
    }
  }
  
  console.log('✅ Supabase cleanup complete\n')
}

async function main() {
  console.log('🚨 WARNING: This will delete ALL test data!\n')
  
  try {
    await cleanupStripe()
    await cleanupSupabase()
    
    console.log('✅ All cleanup complete!')
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  }
}

main()

