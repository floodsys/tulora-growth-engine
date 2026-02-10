# PR Summary — Security Hardening (Phases 1–7)

**Branch:** `wip/migration-edits`
**Base:** `origin/wip/migration-edits` (post merge PR #3)

---

## What Changed

| Commit | Area | Description |
|--------|------|-------------|
| `4e00d66` | Billing | **Fail-closed when Stripe key missing** — `syncStripeSeatsForOrg` now returns `success: false` with `STRIPE_SECRET_KEY_MISSING` instead of silently succeeding. Prevents seat-sync from being skipped when env is misconfigured. |
| `f30c5c0` | Webhooks | **Timing-safe signature verification** — Retell webhook handler now enforces HMAC-SHA256 signature check using constant-time comparison (`timingSafeEqual`). Requests with missing or invalid signatures are rejected with 401. |
| `2973089` | Contact Sales | **Turnstile hostname validation** — Server-side Turnstile verification now validates the `hostname` field returned by Cloudflare siteverify against an allowlist, blocking token-replay attacks from unauthorized origins. |
| `6c474f6` | Edge Functions | **Remove dead function `retell-webhook-enhanced`** — Deleted the unused/duplicate edge function directory that was never deployed; reduces attack surface and maintenance burden. |
| `da7b4b2` | Database | **Harden `search_path` on SECURITY DEFINER functions** — All `SECURITY DEFINER` functions now have an explicit `SET search_path = ''` (or scoped path) to prevent search-path hijacking. |
| `73e2de8` | Repo Hygiene | **Gitignore local audit artifacts** — Added `gitleaks.exe`, `cached_diff.txt`, `fix_*.py`, `temp-*.txt`, and other one-off audit files to `.gitignore` so they are excluded from future commits. |
| `d6d4e2f` | Documentation | **JWT bypass documentation** — Added `docs/security/jwt-bypass.md` documenting which edge-function routes intentionally skip `verify_jwt` and the security controls that compensate. |
| `e303adc` | CI Regression | **DB reset + Deno test gate** — Added `supabase db reset` and `deno test` commands to the CI regression checklist, ensuring migrations apply cleanly and shared logic tests pass on every change. |

---

## Risk / Impact Notes

| Risk | Mitigation |
|------|------------|
| **Billing fail-closed** may surface errors in dev/staging where `STRIPE_SECRET_KEY` is intentionally absent. | The error message includes setup instructions. Callers already handle `success: false` gracefully; no user-facing breakage expected. |
| **Webhook signature enforcement** will reject any Retell callback that arrives without a valid `X-Retell-Signature` header. | This is the intended behavior. Retell always sends the header in production; only hand-crafted test requests will break (update test tooling accordingly). |
| **Turnstile hostname validation** will reject tokens obtained on domains outside the allowlist. | Allowlist is configured via `TURNSTILE_ALLOWED_HOSTNAMES` and defaults to the known production + preview domains. If a new deploy domain is added, the allowlist must be updated. |
| **search_path hardening** on SECURITY DEFINER functions changes function signatures in migrations. | All migrations replay cleanly (`supabase db reset` passes). No runtime SQL behavior change — only the implicit search path is restricted. |
| **Dead function removal** (`retell-webhook-enhanced`) | Function was never wired into `config.toml` `verify_jwt` overrides or deployed. Zero production impact. |

---

## How to Test

### 1. Vite Production Build
```bash
npx vite build
# ✓ Expected: "built in ≈15s", no errors (warnings about chunk size are informational)
```

### 2. Deno Unit Tests (shared edge-function logic)
```bash
deno test --allow-env supabase/functions/_shared/__tests__/*.test.ts
# ✓ Expected: 8 passed, 0 failed
```

### 3. Local Database Reset (migrations replay)
```bash
npx --yes supabase@2.76.6 db reset
# ✓ Expected: "Finished supabase db reset on branch wip/migration-edits."
```

### 4. Manual Spot-Checks
- **Billing fail-closed:** Unset `STRIPE_SECRET_KEY` and invoke `sync-stripe-seats`; confirm it returns `{ success: false, error: "STRIPE_SECRET_KEY_MISSING" }`.
- **Webhook signature:** Send a POST to `retell-webhook` without `X-Retell-Signature` header; confirm 401 response.
- **Turnstile hostname:** Submit the contact-sales form from an unknown origin; confirm server rejects with hostname mismatch error.

---

## Files Changed (summary)

```
supabase/functions/_shared/billingSeats.ts          — fail-closed logic
supabase/functions/_shared/retellWebhookSignature.ts — timing-safe HMAC verify
supabase/functions/_shared/turnstileVerify.ts       — hostname allowlist
supabase/functions/_shared/__tests__/*.test.ts      — new/updated tests
supabase/functions/retell-webhook/index.ts          — signature enforcement
supabase/functions/contact-sales/index.ts           — turnstile server check
supabase/functions/retell-webhook-enhanced/         — REMOVED (dead code)
supabase/migrations/*_harden_search_path.sql        — search_path fix
.gitignore                                          — audit artifact exclusions
docs/security/jwt-bypass.md                         — new documentation
```
