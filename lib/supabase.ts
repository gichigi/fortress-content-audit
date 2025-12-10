import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey)

// Email capture types
export interface EmailCapture {
  id?: string
  session_token: string
  email: string
  captured_at?: string
  payment_completed: boolean
  abandoned_email_sent?: boolean
} 