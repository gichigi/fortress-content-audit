/**
 * Jest setup file
 * Runs before each test file
 */

// Load environment variables from .env.local
const { config } = require('dotenv')
const { resolve } = require('path')

config({ path: resolve(process.cwd(), '.env.local') })

// Set test environment variables if not already set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn('⚠️  NEXT_PUBLIC_SUPABASE_URL not set. Tests may fail.')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Tests may fail.')
}

// Increase timeout for async operations
jest.setTimeout(30000)

// Global test utilities
global.generateTestId = () => {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

