/**
 * Stripe user test helpers
 * Utilities for creating test users and profiles for Stripe payment tests
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'

const supabase = getSupabaseAdmin()

/**
 * Create a test user and get their access token
 */
export async function createTestUser(email: string, password: string = 'test-password-123') {
  // Create user via admin API
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for testing
  })

  if (createError || !userData?.user) {
    throw new Error(`Failed to create test user: ${createError?.message || 'Unknown error'}`)
  }

  // Get access token by signing in
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !sessionData?.session?.access_token) {
    // Clean up user if sign-in fails
    await supabase.auth.admin.deleteUser(userData.user.id)
    throw new Error(`Failed to sign in test user: ${signInError?.message || 'Unknown error'}`)
  }

  return {
    userId: userData.user.id,
    email: userData.user.email!,
    accessToken: sessionData.session.access_token,
    session: sessionData.session,
  }
}

/**
 * Delete a test user
 */
export async function deleteTestUser(userId: string) {
  await supabase.auth.admin.deleteUser(userId)
}

/**
 * Get or create a test user profile
 */
export async function getOrCreateTestProfile(userId: string, plan: 'free' | 'pro' = 'free') {
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingProfile) {
    return existingProfile
  }

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      plan,
    })
    .select()
    .single()

  if (error) throw error
  return newProfile
}

/**
 * Update test user profile
 */
export async function updateTestProfile(
  userId: string,
  updates: {
    plan?: 'free' | 'pro'
    stripe_customer_id?: string
    stripe_subscription_id?: string
    current_period_end?: string | null
  }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Clean up test profile
 */
export async function cleanupTestProfile(userId: string) {
  await supabase
    .from('profiles')
    .delete()
    .eq('user_id', userId)
}

/**
 * Clean up test email captures
 */
export async function cleanupTestEmailCaptures(sessionToken: string) {
  await supabase
    .from('email_captures')
    .delete()
    .eq('session_token', sessionToken)
}

/**
 * Create test email capture
 */
export async function createTestEmailCapture(
  email: string,
  sessionToken: string,
  options?: {
    payment_completed?: boolean
    abandoned_email_sent?: boolean
  }
) {
  const { data, error } = await supabase
    .from('email_captures')
    .upsert({
      email,
      session_token: sessionToken,
      payment_completed: options?.payment_completed || false,
      abandoned_email_sent: options?.abandoned_email_sent || false,
    }, {
      onConflict: 'session_token',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Clean up all test data for a user
 */
export async function cleanupTestUserData(userId: string) {
  await Promise.all([
    cleanupTestProfile(userId),
    // Note: email_captures are cleaned by session_token, not user_id
  ])
}

