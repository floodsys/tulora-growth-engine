# Beta Readiness Verification Scripts

CLI-driven checks that validate external service configurations before beta launch.
Run all checks at once with:

```bash
npm run verify:beta
```

## Individual Scripts

| Script | Purpose | Required Env Vars |
|--------|---------|-------------------|
| `retell-webhook-config.mjs` | Verifies Retell agents have correct webhook URLs and events | `RETELL_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `stripe-webhook-endpoints.mjs` | Verifies Stripe webhook endpoints point to org-billing-webhook | `STRIPE_SECRET_KEY`, `SUPABASE_URL` |
| `scheduler-check.mjs` | Detects pg_cron / scheduled function jobs | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (optional) |
| `github-actions-permissions.sh` | Checks repo default_workflow_permissions and explicit permissions blocks | `gh` CLI authenticated |

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

# GitHub Actions permissions (requires bash + gh CLI)
bash scripts/verify/github-actions-permissions.sh
```

## Exit Codes

- `0` — All checks PASS (or SKIP/UNKNOWN for optional checks)
- `1` — At least one check FAILed

## Checks That Require Privileged Credentials

Some checks cannot be fully automated without specific credentials:

1. **Retell webhook config** — Requires `RETELL_API_KEY` (platform API key, not available in CI by default)
2. **Stripe webhook endpoints** — Requires `STRIPE_SECRET_KEY` (live or test key)
3. **Scheduler check** — May need direct `DATABASE_URL` if pg_cron is used (PostgREST cannot query `cron` schema)
4. **GitHub Actions permissions** — Requires `gh` CLI with admin-level access to read repo permission settings

## CI Integration

The `verify:beta` script gracefully degrades when secrets are absent — checks that
cannot run without credentials will SKIP (exit 0) rather than FAIL. To run in CI:

```yaml
- name: Beta readiness check
  if: env.RETELL_API_KEY != ''
  run: npm run verify:beta
  env:
    RETELL_API_KEY: ${{ secrets.RETELL_API_KEY }}
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```
