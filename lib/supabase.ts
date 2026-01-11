import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy-initialized client to avoid module-load-time issues during build
let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  _supabase = createClient(supabaseUrl, supabaseKey)
  return _supabase
}

// Export proxy object that lazily initializes
export const supabase = {
  get from() { return getSupabase().from.bind(getSupabase()) },
  get auth() { return getSupabase().auth },
  get storage() { return getSupabase().storage },
  get rpc() { return getSupabase().rpc.bind(getSupabase()) },
} as SupabaseClient

// Email capture types
export interface EmailCapture {
  id?: string
  session_token: string
  email: string
  captured_at?: string
  payment_completed: boolean
  abandoned_email_sent?: boolean
} 