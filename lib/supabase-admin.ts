import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Lazy-initialized admin client to avoid module-load-time issues in Next.js dev
let _supabaseAdmin: SupabaseClient<Database> | null = null

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_supabaseAdmin) return _supabaseAdmin

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  _supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return _supabaseAdmin
}

// Legacy export for backwards compatibility - use getSupabaseAdmin() in new code
export const supabaseAdmin = {
  get from() { return getSupabaseAdmin().from.bind(getSupabaseAdmin()) },
  get auth() { return getSupabaseAdmin().auth },
  get storage() { return getSupabaseAdmin().storage },
  get rpc() { return getSupabaseAdmin().rpc.bind(getSupabaseAdmin()) },
}