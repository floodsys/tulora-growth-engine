# Beta Readiness Verification Scripts

CLI-driven checks that validate external service configurations before beta launch.
Run all checks at once with:

```bash
npm run verify:beta          # normal mode (SKIP/UNKNOWN are tolerated)
npm run verify:beta:strict   # strict mode (only PASS is accepted)
```

## Statuses

| Status    | Meaning |
|-----------|---------|
| **PASS**    | Check ran and succeeded |
| **FAIL**    | Check ran and found a problem, or script crashed / is missing |
| **SKIP**    | Check could not run because credentials are missing |
| **UNKNOWN** | Check ran but could not determine a result |

## Exit Codes

- **Normal mode:** `0` = no FAIL, `1` = any FAIL (SKIP/UNKNOWN are tolerated)
- **Strict mode:** `0` = all PASS, `1` = any FAIL/SKIP/UNKNOWN

## Individual Scripts

| Script | Purpose | Required Env Vars |
|--------|---------|-------------------|
| `retell-webhook-config.mjs` | Verifies Retell agents have correct webhook URLs and events | `RETELL_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `stripe-webhook-endpoints.mjs` | Verifies Stripe webhook endpoints point to org-billing-webhook | `STRIPE_SECRET_KEY`, `SUPABASE_URL` |
| `scheduler-check.mjs` | Detects pg_cron / scheduled function jobs | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (optional) |
| `github-actions-permissions.mjs` | Checks repo default_workflow_permissions and explicit permissions blocks | `gh` CLI authenticated |

## Environment Variables

| Variable | Source | Used By |
|----------|--------|---------|
| `RETELL_API_KEY` | Retell dashboard → API Keys | retell-webhook-config |
| `STRIPE_SECRET_KEY` | Stripe dashboard → API Keys | stripe-webhook-endpoints |
| `SUPABASE_URL` | Supabase project settings (or `VITE_SUPABASE_URL`) | retell, stripe, scheduler |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API | retell, scheduler |
| `DATABASE_URL` | Direct Postgres connection string (optional) | scheduler |

> **Security:** No secrets are printed. Keys are shown only as redacted hints (e.g., `sk_l…4xYz`).

## Running Individual Checks

```bash
# Retell webhook config
node scripts/verify/retell-webhook-config.mjs

# Stripe webhook endpoints
node scripts/verify/stripe-webhook-endpoints.mjs

# Scheduler / cron jobs
node scripts/verify/scheduler-check.mjs

# GitHub Actions permissions (cross-platform, no bash required)
node scripts/verify/github-actions-permissions.mjs
```

## Cross-Platform Compatibility

All verification scripts are pure Node.js (`.mjs`). No bash or shell dependencies.
Works on Windows, macOS, and Linux without any additional setup.

## Strict Mode

Strict mode treats SKIP and UNKNOWN as failures. Use it when you need to guarantee
every check has actually run and passed (e.g., before a production release):

```bash
npm run verify:beta:strict
# or
VERIFY_STRICT=1 npm run verify:beta
# or
node scripts/verify/run-all.mjs --strict
```

## CI Integration

The `verify:beta` script gracefully degrades when secrets are absent — checks that
cannot run without credentials will SKIP (not fake PASS). To run in CI:

```yaml
- name: Beta readiness check
  run: npm run verify:beta
  env:
    RETELL_API_KEY: ${{ secrets.RETELL_API_KEY }}
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

# Optional: strict mode for release gates
- name: Beta readiness check (strict)
  run: npm run verify:beta:strict
  env:
    RETELL_API_KEY: ${{ secrets.RETELL_API_KEY }}
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```
