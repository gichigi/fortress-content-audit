# Testing Guide

## Overview

Tests are organized to prioritize non-AI components using mock data to avoid expensive model calls.

## Setup

### Prerequisites

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   Create `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Set up test database:**
   - Use Supabase local instance: `supabase start`
   - Or use a dedicated test database
   - Run migrations: `supabase db reset` (for local) or apply migrations to test DB

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Run only database storage tests
pnpm test:db
```

## Test Structure

### Test Files

- `__tests__/database-storage.test.ts` - Database operations with mock data
- `__tests__/api-endpoints.test.ts` - API route endpoints with mock data (requires running server)
- `__tests__/auth.test.ts` - Authentication flow tests
- `__tests__/billing.test.ts` - Stripe webhook tests
- `__tests__/export.test.ts` - Export format validation

### Test Helpers

- `__tests__/helpers/test-db.ts` - Database test utilities and mock data generators (reused by API tests)

## Mock Data Strategy

All tests use mock data to avoid AI model calls:

- **Mock audit data:** Generated to match API schema exactly
- **Mock issue groups:** Various severities and scenarios
- **Mock issue states:** Active, ignored, resolved states
- **Test fixtures:** Pre-defined scenarios (empty, many issues, etc.)

## Database Testing

### Approach

1. **Use Supabase admin client** for setup/teardown (bypasses RLS)
2. **Test with mock data** - no real audit model calls
3. **Clean up after each test** - prevent test pollution
4. **Test RLS policies** separately with authenticated clients

### Test Coverage

- ✅ Unauthenticated storage (session_token)
- ✅ Authenticated storage (user_id)
- ✅ Session token expiry (24h window)
- ✅ Concurrent claims
- ✅ Issue state persistence
- ✅ Audit history retrieval
- ✅ Pagination

### Example

```typescript
import { createTestAuditUnauthenticated, cleanupTestDataForSessionToken } from './helpers/test-db'

describe('My Test', () => {
  const sessionToken = generateSessionToken()
  
  afterEach(async () => {
    await cleanupTestDataForSessionToken(sessionToken)
  })
  
  it('should save audit', async () => {
    const audit = await createTestAuditUnauthenticated(sessionToken)
    expect(audit).toBeTruthy()
  })
})
```

## RLS Testing

**Note:** RLS (Row Level Security) tests require authenticated Supabase clients, not admin client. The admin client bypasses RLS.

For real RLS testing:
1. Create test users via Supabase auth
2. Get their access tokens
3. Create authenticated Supabase clients
4. Test that users can only access their own data

## Best Practices

1. **Always clean up** - Use `afterEach` to remove test data
2. **Use unique identifiers** - Generate unique session tokens, user IDs per test
3. **Mock data only** - Never call real AI models in tests
4. **Test edge cases** - Expired tokens, concurrent operations, etc.
5. **Isolate tests** - Each test should be independent

## Troubleshooting

### Tests fail with "Missing Supabase environment variables"
- Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Tests fail with database errors
- Ensure Supabase is running: `supabase status`
- Check migrations are applied: `supabase db reset` (local) or check remote DB

### RLS tests not working
- RLS tests need authenticated clients, not admin client
- Create test users first, then use their tokens

## API Endpoint Testing

**Note:** API endpoint tests (`api-endpoints.test.ts`) require a running Next.js server on `localhost:3000`. 

To run API tests:
1. Start dev server: `pnpm dev` (in separate terminal)
2. Run tests: `pnpm test:api`

**Alternative:** Test route handlers directly by importing and calling them with `Request` objects (no server needed).

## Next Steps

- [x] Add API endpoint tests with mock data ✅
- [ ] Add UI component tests
- [ ] Add integration tests for full flows
- [ ] Set up CI/CD test runs

