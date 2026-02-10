# Testing Guide for Superadmin Authorization

## Overview

This project includes comprehensive tests to ensure all superadmin authorization follows the **DB-RPC policy**:

> **Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.**

## Running Tests Locally

### Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up test environment variables:**
   ```bash
   cp .env.example .env.test
   # Edit .env.test with test configuration
   ```

3. **Create test JWT tokens:**
   - Log in as a superadmin user and copy JWT from browser dev tools
   - Log in as a regular user and copy JWT from browser dev tools
   - Set as environment variables:
   ```bash
   export TEST_SUPERADMIN_JWT="your-superadmin-jwt-here"
   export TEST_REGULAR_USER_JWT="your-regular-user-jwt-here"
   ```

### Test Commands

```bash
# Run all tests
npm test

# Run only superadmin authorization tests
npm run test:superadmin

# Run tests with UI (interactive)
npm run test:ui

# Run tests with coverage
npm run test:ci

# Run integration tests (requires real JWT tokens)
npm run test:run -- src/test/edge-functions.integration.test.ts
```

### Test Categories

#### 1. Unit Tests (`src/test/superadmin-auth.test.ts`)
- **DB RPC Policy**: Verifies all hooks use `supabase.rpc('is_superadmin')`
- **Environment Variables**: Ensures env vars are cosmetic only
- **Error Messages**: Validates standardized 403 messages
- **Security Policy**: Confirms documentation is correct

#### 2. Integration Tests (`src/test/edge-functions.integration.test.ts`)
- **Edge Functions**: Tests real HTTP calls to admin endpoints
- **Authorization**: Verifies 200 for superadmin, 403 for regular users
- **DB RPC**: Tests direct database function calls

#### 3. CI Lint Checks (`.github/workflows/superadmin-auth-tests.yml`)
- **Code Scanning**: Greps codebase for forbidden authorization patterns
- **Policy Compliance**: Ensures no env-based authorization logic
- **Documentation**: Verifies security docs are complete

## Test Scenarios

### ✅ Expected Behaviors

**Superadmin User (`admin@axionstack.xyz`):**
- ✅ DB RPC returns `true`
- ✅ All admin routes return 200
- ✅ All admin APIs return 200

**Regular User:**
- ✅ DB RPC returns `false`
- ✅ All admin routes return 403
- ✅ All admin APIs return 403

### ❌ Test Failures

Tests will fail if:
- Any authorization logic uses environment variables
- Direct email comparisons are used for access control
- Admin endpoints don't use `supabaseClient.rpc('is_superadmin')`
- Error messages aren't standardized
- Security documentation is missing

## CI Integration

### GitHub Actions Workflow

The CI pipeline runs on every PR and includes:

1. **Build Verification**: Ensures code compiles
2. **Unit Tests**: Verifies all authorization logic
3. **Integration Tests**: Tests real edge function calls
4. **Security Scanning**: Greps for authorization violations
5. **Documentation Check**: Verifies security docs

### Required Secrets

Configure these in your GitHub repository:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TEST_SUPERADMIN_JWT=jwt-for-admin@axionstack.xyz
TEST_REGULAR_USER_JWT=jwt-for-regular-user
```

### PR Requirements

PRs will be **blocked** if:
- Authorization tests fail
- Security policy violations are detected
- Environment variables are used for authorization
- Documentation is incomplete

## Debugging Test Failures

### Common Issues

1. **"Environment variable used for authorization"**
   - Check code doesn't use `import.meta.env.VITE_SUPERADMINS_EMAILS` for access control
   - Env vars should only be used for UI hints

2. **"Admin hooks not using DB RPC"**
   - Verify `useAdminAccess()` and `useSuperadmin()` call `supabase.rpc('is_superadmin')`

3. **"Edge functions not using DB RPC"**
   - Check admin edge functions call `supabaseClient.rpc('is_superadmin')`

4. **"JWT token expired"**
   - Refresh test JWT tokens in CI secrets

### Manual Verification

```bash
# Test specific endpoint manually (replace <TOKEN> with a valid JWT)
curl -X POST https://your-project.supabase.co/functions/v1/admin-billing-actions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action":"test"}'

# Should return 200 for superadmin, 403 for regular user
```

## Security Policy Enforcement

The tests enforce this critical security principle:

> **All superadmin authorization decisions MUST use `supabase.rpc('is_superadmin')` as the single source of truth. Environment variables are COSMETIC ONLY.**

This ensures:
- Consistent authorization across client, server, and edge functions
- No bypassing of database-controlled access
- Audit trail of all authorization decisions
- Prevention of stale environment-based guards