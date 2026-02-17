# Rollback Playbook — Tulora Closed Beta

> **Audience:** On-call engineer, platform team lead  
> **Last updated:** 2026-02-14  
> **Scope:** Frontend (Vercel), Supabase Edge Functions, Database migrations, Webhook safety

---

## Table of Contents

1. [When to Rollback — Decision Tree](#1-when-to-rollback--decision-tree)
2. [Frontend Rollback (Vercel)](#2-frontend-rollback-vercel)
3. [Edge Functions Rollback](#3-edge-functions-rollback)
4. [Database / Migration Rollback](#4-database--migration-rollback)
5. [Webhook Containment (Retell & Stripe)](#5-webhook-containment-retell--stripe)
6. [Kill Switch — Disable Retell Call Initiation](#6-kill-switch--disable-retell-call-initiation)
7. [Post-Incident Checklist](#7-post-incident-checklist)
8. [Verification Commands](#8-verification-commands)
9. [Soft Branch Protection (GitHub Free Limitation)](#9-soft-branch-protection-github-free-limitation)

---

## 1. When to Rollback — Decision Tree

```
Is the issue affecting active users RIGHT NOW?
├── YES → Is it a data-corruption / billing issue?
│   ├── YES → Jump to §4 (migration rollback) + §5 (webhook containment)
│   └── NO  → Is it a broken UI / white-screen?
│       ├── YES → Jump to §2 (frontend rollback)
│       └── NO  → Is it a broken Edge Function (call failures, 500s)?
│           ├── YES → Jump to §3 (edge function rollback)
│           │         Consider §6 (kill switch) if calls are costing money
│           └── NO  → Can you forward-fix within 30 minutes?
│               ├── YES → Forward-fix on main, deploy
│               └── NO  → Rollback to last known good (§2 or §3)
└── NO  → Forward-fix on main, deploy when ready
```

**General principle:** Prefer forward-fix when safe and fast. Rollback when the blast radius is large or the fix timeline is uncertain.

---

## 2. Frontend Rollback (Vercel)

The frontend is a Vite + React SPA deployed to Vercel. Every push to `main` triggers a production deployment. Vercel retains all previous deployments.

### Option A: Vercel Dashboard Instant Rollback

1. Go to [Vercel Dashboard → Deployments](https://vercel.com/dashboard)
2. Find the last known-good deployment (check `X-Commit-SHA` header or deployment timestamp)
3. Click **⋯ → Promote to Production**
4. Verify the site loads and the `X-Commit-SHA` response header matches the expected commit

### Option B: Git SHA Pin + Redeploy

```bash
# Identify the last known-good commit
git log --oneline -10

# Force-deploy that commit via Vercel CLI
npx vercel --prod --force --token=$VERCEL_TOKEN

# Or: revert on main and push
git revert <bad-commit-sha> --no-edit
git push origin main
```

### Verification

```bash
# Check deployed commit SHA via response header
curl -sI https://app.tulora.com | grep -i x-commit-sha

# Smoke test
curl -sf https://app.tulora.com/version.json | jq .
```

> **Note:** `vercel.json` injects `X-Commit-SHA` and `X-Build-Id` headers on every response — use these to confirm which commit is live.

---

## 3. Edge Functions Rollback

Supabase Edge Functions are deployed from the repo via the Supabase CLI. There is no built-in "instant rollback" in the Supabase dashboard — you redeploy from a previous commit.

### Steps

```bash
# 1. Identify the last known-good commit for the function(s)
git log --oneline -10 -- supabase/functions/<function-name>/

# 2. Check out that commit in a temporary worktree (or just deploy from it)
git checkout <good-sha> -- supabase/functions/<function-name>/

# 3. Deploy the single function
npx supabase functions deploy <function-name> --project-ref nkjxbeypbiclvouqfjyc

# 4. Or deploy ALL functions from the known-good state
git stash  # save current work
git checkout <good-sha>
npx supabase functions deploy --project-ref nkjxbeypbiclvouqfjyc
git checkout -  # return to previous branch
git stash pop
```

### Key Functions (high-cost / high-risk)

| Function | Risk | Notes |
|---|---|---|
| `retell-outbound` | **High** — initiates paid phone calls | Has kill switch (`DISABLE_RETELL_CALLS`) |
| `retell-webcall-create` | **High** — initiates paid web calls | Has kill switch (`DISABLE_RETELL_CALLS`) |
| `retell-webhook` | **Medium** — processes inbound call events | Signature-verified; idempotent via `merge_retell_call_event` |
| `org-billing-webhook` | **Medium** — processes Stripe events | Signature-verified; `verify_jwt = false` |
| `retell-dial` / `retell-dial-outbound` | **Medium** — call initiation variants | JWT-verified |

### Verification

```bash
# Health check for retell functions
curl -sf "https://nkjxbeypbiclvouqfjyc.supabase.co/functions/v1/retell-outbound/health" \
  -H "Authorization: Bearer <anon-key>" | jq .

curl -sf "https://nkjxbeypbiclvouqfjyc.supabase.co/functions/v1/retell-webcall-create/health" \
  -H "Authorization: Bearer <anon-key>" | jq .
```

---

## 4. Database / Migration Rollback

### ⚠️ Important Limitations

- **Supabase hosted Postgres does not support `DOWN` migrations.** The migration system is forward-only.
- **We do NOT have automated rollback scripts** for individual migrations.
- **`DROP CASCADE` is banned** by CI (`check-no-risky-drop-cascade.cjs`).

### Strategy: Forward-Fix (Preferred)

For most schema issues, write a new corrective migration:

```bash
# 1. Write a fix migration
cat > supabase/migrations/$(date +%Y%m%d%H%M%S)_fix_<description>.sql << 'EOF'
-- Corrective migration: describe what this fixes
ALTER TABLE <table> ...;
EOF

# 2. Test locally
npx supabase db reset
npx supabase db push --dry-run

# 3. Apply to production
npx supabase db push --project-ref nkjxbeypbiclvouqfjyc
```

### Strategy: Point-in-Time Recovery (Nuclear Option)

If data corruption is severe and forward-fix is insufficient:

1. **Contact Supabase support** or use the Dashboard → Database → Backups
2. Supabase Pro plan includes daily backups + point-in-time recovery (PITR)
3. **PITR restores the entire database** — coordinate with the team before triggering
4. After restore, re-apply any migrations that occurred after the restore point

> **Warning:** PITR is a full database restore. It will roll back ALL changes (data + schema) to the chosen point. There is no table-level restore. Use only as a last resort.

### CI Guardrails (Prevention)

These scripts run in CI and catch common migration issues before they reach production:

- `check-no-risky-drop-cascade.cjs` — blocks `DROP ... CASCADE`
- `check-no-seed-in-migrations.cjs` — blocks seed data in migration files
- `check-no-superadmin-uuid-constants.cjs` — blocks hardcoded superadmin UUIDs
- `check-security-definer-search-path.cjs` — enforces `search_path` on `SECURITY DEFINER` functions
- `check-rls-tautologies.cjs` — detects RLS policies that are always-true

---

## 5. Webhook Containment (Retell & Stripe)

During an incident, external services may keep sending webhook events. Here's how to safely contain them.

### Retell Webhooks (`retell-webhook`)

The `retell-webhook` function is signature-verified and idempotent (uses `merge_retell_call_event` RPC with payload hashing). It is generally **safe to leave running** — it will not create duplicate records.

**If you need to stop processing:**

1. **Fastest:** Set `RETELL_WEBHOOK_SECRET` to an invalid value in Supabase Dashboard → Edge Functions → Secrets. All incoming webhooks will fail signature verification and return 401. Retell will retry, but events will be rejected safely.
2. **Alternative:** Deploy a stub function that returns `200 OK` immediately (prevents Retell from marking the endpoint as unhealthy and disabling it):

```typescript
// Temporary stub — returns 200 to prevent Retell endpoint deactivation
serve(async () => new Response(null, { status: 200 }));
```

3. **After the incident:** Restore the correct `RETELL_WEBHOOK_SECRET`. Retell retries will succeed and idempotency ensures no duplicates.

### Stripe Webhooks (`org-billing-webhook`)

1. **Fastest containment:** In Stripe Dashboard → Developers → Webhooks, **disable the endpoint** temporarily.
2. **Alternative:** Rotate `STRIPE_WEBHOOK_SECRET` in Supabase secrets to reject all events (they'll queue in Stripe for retry).
3. **After the incident:** Re-enable the Stripe webhook endpoint. Stripe automatically retries failed events for up to 3 days.

### Retell Call Initiation (Stop the Bleeding)

If Retell calls are misfiring or costing money during an incident:

1. **Use the kill switch** (see §6): Set `DISABLE_RETELL_CALLS=true` in Supabase Edge Function secrets
2. **Or:** Temporarily invalidate `RETELL_API_KEY` in Supabase secrets (all call-init functions will fail with `MISCONFIG`)

---

## 6. Kill Switch — Disable Retell Call Initiation

Both `retell-outbound` and `retell-webcall-create` check for a `DISABLE_RETELL_CALLS` environment variable. When set to any truthy value (`true`, `1`, `yes`), they immediately return `503 Service Unavailable` without calling the Retell API.

### Activate the Kill Switch

```bash
# Via Supabase CLI
npx supabase secrets set DISABLE_RETELL_CALLS=true --project-ref nkjxbeypbiclvouqfjyc

# Or via Supabase Dashboard:
# Project → Edge Functions → Secrets → Add DISABLE_RETELL_CALLS = true
```

### Deactivate the Kill Switch

```bash
# Remove the secret (functions will read undefined → calls resume)
npx supabase secrets unset DISABLE_RETELL_CALLS --project-ref nkjxbeypbiclvouqfjyc
```

### What it affects

| Function | Effect when kill switch is ON |
|---|---|
| `retell-outbound` | Returns `503` with `CALLS_DISABLED` error code. No Retell API call made. |
| `retell-webcall-create` | Returns `503` with `CALLS_DISABLED` error code. No Retell API call made. |
| `retell-webhook` | **Not affected** — still processes inbound events normally |
| `retell-dial` / `retell-dial-outbound` | **Not affected** — would need separate kill switch if needed |

> **Note:** The kill switch only gates outbound + webcall initiation. Inbound webhook processing is unaffected, which is intentional — you want to keep recording call results even if you stop initiating new calls.

---

## 7. Post-Incident Checklist

After resolving the incident and restoring service:

- [ ] **Verify frontend** — Check `X-Commit-SHA` header matches expected commit
- [ ] **Verify Edge Functions** — Hit `/health` endpoints for critical functions
- [ ] **Verify database** — Run `npx supabase db push --dry-run` to confirm schema is in sync
- [ ] **Check webhook backlogs** — Review Stripe Dashboard retry queue; check Supabase logs for retell-webhook errors
- [ ] **Remove kill switch** if activated — `supabase secrets unset DISABLE_RETELL_CALLS`
- [ ] **Restore rotated secrets** if any were changed during containment
- [ ] **Run smoke tests** — `npm run verify:beta` or trigger the GitHub Action manually
- [ ] **Review audit logs** — Check `audit_logs` table for any anomalies during the incident window
- [ ] **Write incident report** — Document timeline, root cause, remediation, and prevention actions
- [ ] **Notify stakeholders** — Inform affected users/orgs if there was visible impact

---

## 8. Verification Commands

### Frontend Health

```bash
# Check deployed version
curl -sI https://app.tulora.com | grep -i x-commit-sha

# Version endpoint (no-cache headers enforced)
curl -sf https://app.tulora.com/version.json | jq .
```

### Edge Function Health

```bash
PROJECT_REF="nkjxbeypbiclvouqfjyc"
BASE="https://${PROJECT_REF}.supabase.co/functions/v1"

# Retell outbound health
curl -sf "${BASE}/retell-outbound/health" -H "Authorization: Bearer ${ANON_KEY}" | jq .

# Retell webcall health
curl -sf "${BASE}/retell-webcall-create/health" -H "Authorization: Bearer ${ANON_KEY}" | jq .

# DB health check (if deployed)
curl -sf "${BASE}/db-health-check" -H "Authorization: Bearer ${ANON_KEY}" | jq .
```

### Database Health

```bash
# Check migration status
npx supabase db push --dry-run --project-ref nkjxbeypbiclvouqfjyc

# Verify RLS policies are intact
npx supabase db lint --project-ref nkjxbeypbiclvouqfjyc
```

### CI / Smoke Tests

```bash
# Local verification suite
npm run verify:beta

# Strict mode (fails on warnings)
npm run verify:beta:strict

# Trigger GitHub Actions smoke test manually
gh workflow run smoke-tests.yml
```

---

## 9. Soft Branch Protection (GitHub Free Limitation)

> **Context:** GitHub Free plans for **private** repositories do not support
> branch-protection rules or repository rulesets. This means we cannot block
> direct pushes to `main` at the platform level.

### What we have instead

The workflow **`.github/workflows/guard-main-direct-push.yml`** runs on every
push to `main` and checks whether the commit SHA is associated with a merged
pull request.

| Scenario | Result |
|---|---|
| Push via merged PR | ✅ No action taken |
| Direct push (no PR) | 🚨 GitHub Issue opened with commit details |
| Direct push + `AUTO_REVERT_DIRECT_PUSH=true` | 🚨 Issue opened **and** a revert PR is created automatically |

### Enabling auto-revert (optional)

By default the workflow only opens an issue. To enable automatic revert PRs:

1. Go to **Settings → Secrets and variables → Actions → Variables**
2. Create a **repository variable** named `AUTO_REVERT_DIRECT_PUSH` with value `true`

> **Warning:** Auto-revert may fail if the commit has merge conflicts with
> subsequent changes. In that case the workflow logs an error and manual
> intervention is required.

### When will this be unnecessary?

This guard is a **best-effort mitigation** until one of the following is true:

- The repository is upgraded to **GitHub Pro / Team / Enterprise** (which
  support branch-protection rules on private repos), **or**
- The repository is made **public** (GitHub Free supports branch protection
  on public repos)

At that point, enable native branch-protection rules and this workflow can
be removed.

---

## Appendix: File Reference

| Path | Purpose |
|---|---|
| `vercel.json` | Vercel config — injects `X-Commit-SHA` header |
| `supabase/config.toml` | Edge Function JWT verification settings |
| `supabase/functions/_shared/env.ts` | Centralized env variable access |
| `supabase/functions/retell-outbound/index.ts` | Outbound call initiation (has kill switch) |
| `supabase/functions/retell-webcall-create/index.ts` | Web call initiation (has kill switch) |
| `supabase/functions/retell-webhook/index.ts` | Inbound webhook processor (signature-verified, idempotent) |
| `supabase/functions/org-billing-webhook/index.ts` | Stripe webhook processor |
| `scripts/verify/run-all.mjs` | Beta verification suite |
| `docs/organization-status-runbook.md` | Org suspension/cancellation procedures |
| `.github/workflows/guard-main-direct-push.yml` | Soft branch protection — detects direct pushes to main (§9) |

---

*This runbook is part of audit backlog item #12. Review quarterly or after any significant infrastructure change.*
