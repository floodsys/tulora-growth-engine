# CI/CD Setup for Invite System Tests

This document explains how to set up continuous integration for the invite system tests.

## Overview

The CI system includes two types of tests:

1. **Full Invite Tests**: Complete test suite with write operations (CI/staging only)
2. **Smoke Tests**: Read-only validation tests (safe for production)

## GitHub Actions Workflows

### 1. Invite Tests (`.github/workflows/invite-tests.yml`)

Runs the complete test suite on:
- Push to `main` or `develop` branches
- Pull requests to `main`
- Manual workflow dispatch

**Environment**: `testing`

**Required Environment Variables**:
```env
VITE_RUN_TEST_LEVEL=full
VITE_TEST_ORG_ID=<dedicated-test-org-uuid>
VITE_DISABLE_EMAIL_DELIVERY_FOR_TESTS=true
VITE_ANALYTICS_EXCLUDE_ORGS=["<test-org-uuid>"]
```

### 2. Smoke Tests (`.github/workflows/smoke-tests.yml`)

Runs read-only validation tests on:
- Scheduled every 6 hours
- After successful deployments
- Manual workflow dispatch

**Environment**: `production`

**Required Environment Variables**:
```env
VITE_RUN_TEST_LEVEL=smoke
VITE_TEST_ORG_ID=<production-test-org-uuid>
VITE_DISABLE_EMAIL_DELIVERY_FOR_TESTS=true
VITE_ANALYTICS_EXCLUDE_ORGS=["<production-test-org-uuid>"]
```

## Setup Instructions

### 1. Create Test Organizations

You need two dedicated test organizations:

1. **Testing Environment**: For CI/staging tests with write operations
2. **Production Environment**: For smoke tests (read-only)

```sql
-- Create test organizations in your Supabase database
INSERT INTO organizations (name, slug, owner_user_id) 
VALUES ('CI Test Organization', 'ci-test-org', '<owner-user-id>');

INSERT INTO organizations (name, slug, owner_user_id) 
VALUES ('Production Test Organization', 'prod-test-org', '<owner-user-id>');
```

### 2. Configure GitHub Environments

#### Testing Environment

1. Go to **Settings > Environments** in your GitHub repository
2. Create environment named `testing`
3. Add the following secrets:

| Secret Name | Description |
|-------------|-------------|
| `TEST_ORG_ID` | UUID of your CI test organization |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for CI tests |

#### Production Environment

1. Create environment named `production`
2. Add the following secrets:

| Secret Name | Description |
|-------------|-------------|
| `PROD_TEST_ORG_ID` | UUID of your production test organization |
| `VITE_SUPABASE_URL` | Your production Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production anon key |
| `VITE_SUPABASE_PROJECT_ID` | Production project ID |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key |

3. Configure protection rules:
   - Require 1 reviewer
   - 5-minute wait timer
   - Restrict to `main` branch only

### 3. Test the Setup

#### Manual Test Run

You can manually run tests locally:

```bash
# Set environment variables
export VITE_RUN_TEST_LEVEL=smoke
export VITE_TEST_ORG_ID=your-test-org-id
export VITE_DISABLE_EMAIL_DELIVERY_FOR_TESTS=true
export VITE_ANALYTICS_EXCLUDE_ORGS='["your-test-org-id"]'
export VITE_SUPABASE_URL=your-supabase-url
export VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Run smoke tests
npm run test:invite:smoke

# Run full tests (only if RUN_TEST_LEVEL=full)
npm run test:invite:full
```

#### Trigger CI Tests

1. **Invite Tests**: Create a pull request or push to `main`/`develop`
2. **Smoke Tests**: Go to Actions tab and manually trigger the workflow

## Test Results

### Success Criteria

- All test suites must pass (return `passed: true`)
- Individual test assertions must not fail
- Environment isolation must be validated

### Failure Handling

#### Invite Tests (CI)
- Failed tests will fail the GitHub Action
- PR comments will show detailed test results
- Artifacts contain full test output

#### Smoke Tests (Production)
- Failed tests create GitHub issues automatically
- Issues are labeled with `bug`, `production`, `smoke-test-failure`
- Artifacts contain test results for investigation

## Monitoring

### Scheduled Smoke Tests

Production smoke tests run every 6 hours to:
- Validate production environment health
- Ensure invite system functionality
- Detect configuration drift

### Alerts

Failed smoke tests automatically:
1. Create GitHub issues with detailed failure information
2. Tag issues for immediate attention
3. Include suggested investigation steps

## Security Considerations

1. **Environment Isolation**: Tests only run against dedicated test organizations
2. **Email Safety**: Email delivery is disabled for all test environments
3. **Analytics Exclusion**: Test traffic is excluded from analytics
4. **Read-Only Production**: Production smoke tests perform no write operations
5. **Secret Management**: All credentials are stored in GitHub environment secrets

## Troubleshooting

### Common Issues

1. **Missing TEST_ORG_ID**: Ensure test organizations are created and UUIDs are configured
2. **Permission Errors**: Verify service role key has appropriate permissions
3. **Environment Mismatch**: Check that test level matches environment configuration
4. **Network Issues**: Verify Supabase URL and connectivity

### Debug Commands

```bash
# Test environment validation
node scripts/run-invite-tests.js --mode=smoke --dry-run

# Check test organization access
npx supabase --project-ref YOUR_PROJECT_ID sql --db-url YOUR_DB_URL \
  --file scripts/validate-test-org.sql
```

### Support

For additional help:
1. Check the GitHub Actions logs for detailed error messages
2. Review test artifacts for full test output
3. Validate environment configuration against this documentation
4. Ensure test organizations have the correct setup and permissions