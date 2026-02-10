# JWT Bypass Allowlist (`verify_jwt = false`)

> **Last updated:** 2026-02-10
> **Total bypass endpoints:** 7
> **Policy:** Every function with `verify_jwt = false` must have a documented alternative
> validation mechanism. No endpoint may bypass JWT without both code-level enforcement
> and an entry in this document.

## Overview

Supabase Edge Functions default to `verify_jwt = true`, requiring a valid Supabase JWT
(anon or authenticated) in the `Authorization` header. Some endpoints must bypass this
check because they are called by external services (webhooks), internal workers (cron/queues),
or anonymous users (public forms, captcha, signed URLs).

Each exception below documents **why** the bypass is necessary and **what alternative
validation** is performed instead.

---

## Allowlist

### 1. `org-billing-webhook`

| Field | Value |
|---|---|
| **Category** | External Webhook (Stripe) |
| **Reason** | Stripe sends HTTP POST callbacks; it cannot include a Supabase JWT. |
| **Alternative validation** | Stripe webhook signature verification via `stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET)`. Rejects immediately on missing/invalid `stripe-signature` header. |
| **Secret(s) required** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Threat model** | Without valid signature, request is rejected with 400. Replay protection via `processed_webhook_events` idempotency table. Service-role DB access is only used after signature passes. |

### 2. `retell-webhook`

| Field | Value |
|---|---|
| **Category** | External Webhook (Retell AI) |
| **Reason** | Retell AI sends HTTP POST callbacks for call events; cannot include a Supabase JWT. |
| **Alternative validation** | HMAC-SHA256 signature verification of request body against `RETELL_WEBHOOK_SECRET`. Requires `x-retell-signature` header. Rejects with 401 if missing or invalid. Body is parsed **only after** signature verification passes. |
| **Secret(s) required** | `RETELL_WEBHOOK_SECRET` |
| **Threat model** | Forged requests rejected by HMAC. No fallback to unsigned processing. Service-role client created only after signature verification succeeds. |

### 3. `sms-webhook`

| Field | Value |
|---|---|
| **Category** | External Webhook (Twilio) |
| **Reason** | Twilio sends HTTP POST callbacks for inbound SMS; cannot include a Supabase JWT. |
| **Alternative validation** | Twilio HMAC-SHA1 signature verification using `TWILIO_AUTH_TOKEN`. Computes expected signature from `TWILIO_WEBHOOK_BASE_URL` + sorted form params and compares against `X-Twilio-Signature` header using **timing-safe comparison** (`timingSafeEqual`). Rejects with 401 if mismatch. |
| **Secret(s) required** | `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_BASE_URL` |
| **Threat model** | Timing-safe comparison prevents timing side-channels. Form data is parsed before signature check (required by Twilio's algorithm) but no DB writes occur until after verification passes. |

### 4. `suitecrm-sync-worker`

| Field | Value |
|---|---|
| **Category** | Internal Worker / Cron |
| **Reason** | Called by internal schedulers and queue processors that do not have Supabase user sessions. |
| **Alternative validation** | Shared secret via `x-internal-secret` header, validated with **constant-time comparison** against `INTERNAL_SUITECRM_WORKER_SECRET`. Rejects with 401 (missing) or 403 (invalid). |
| **Secret(s) required** | `INTERNAL_SUITECRM_WORKER_SECRET` |
| **Threat model** | Length-mismatch is rejected before byte comparison (fast-fail without timing leak on length). Service-role key and DB access only after secret passes. Limited blast radius — processes max 5 outbox entries per invocation. |

### 5. `contact-sales`

| Field | Value |
|---|---|
| **Category** | Public Form Submission |
| **Reason** | Anonymous visitors submit contact/enterprise inquiry forms without authentication. |
| **Alternative validation** | **Multi-layer defense:** (1) Cloudflare Turnstile captcha — **fail-closed** (missing or invalid token → 400/403), (2) In-memory IP rate limiting (10 req/min), (3) Honeypot field (`website` must be empty), (4) Origin allowlist (CORS). |
| **Secret(s) required** | `CLOUDFLARE_TURNSTILE_SECRET_KEY` |
| **Threat model** | Bot/spam protection via Turnstile. Rate limiting caps abuse volume. Honeypot catches naive bots. Service-role DB client used for lead insert (no user session exists). Optional Supabase auth header is checked opportunistically for org context but not required. |

### 6. `secure-resource-access`

| Field | Value |
|---|---|
| **Category** | Signed URL / Resource Download |
| **Reason** | Browser navigations (e.g., clicking "Download Recording") cannot send the Supabase JWT in an `Authorization` header. Auth is embedded in the URL as a signed token. |
| **Alternative validation** | Custom HMAC-SHA256 JWT passed as `?token=` query parameter. Verified with `JWT_SIGNING_SECRET` using `crypto.subtle.verify`. Token contains scoped claims: `sub` (user), `org` (organization), `resource_type`, `resource_id`, `role`, `exp`, `iat`. |
| **Secret(s) required** | `JWT_SIGNING_SECRET` |
| **Token generation** | Tokens are created by `generate-signed-url` (which **is** behind `verify_jwt = true`). That function authenticates the user, verifies org membership + seat status, confirms resource existence, and issues a scoped, time-limited token (default 1 hour). |
| **Claim validation** | `resource_type` and `resource_id` from token must match query parameters. Database queries additionally filter by `organization_id` from the `org` claim, preventing cross-tenant access even if a token is forged for a different resource. |
| **Audit** | Every resource access is logged to `audit_log` with actor, org, resource, and timestamp. |
| **Threat model** | |
| | **Token leakage:** Time-limited (default 1h `exp`), scoped to a single resource+org. Leaked URLs become inert after expiry. |
| | **Token replay:** Valid until `exp` but only usable for the exact resource it was issued for. |
| | **Token forgery:** Requires knowledge of `JWT_SIGNING_SECRET` (server-side only). |
| | **Cross-tenant access:** Prevented by `organization_id` filter in every DB query. |
| | **Privilege escalation:** `role` claim is informational for audit; actual access is gated by token validity + DB row existence. |

### 7. `verify-turnstile`

| Field | Value |
|---|---|
| **Category** | Public Captcha Verification |
| **Reason** | Embeddable widgets call this endpoint to verify Turnstile tokens before any user authentication occurs. |
| **Alternative validation** | (1) **Origin/domain allowlist** — validates `Origin` or `Referer` header against `ALLOWED_WIDGET_DOMAINS` env var (defaults to `localhost` in dev). Rejects with 403 if not allowed. (2) Server-side Turnstile verification via Cloudflare API. |
| **Secret(s) required** | `TURNSTILE_SECRET_KEY` |
| **Additional hardening** | Response includes CSP headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`). |
| **Threat model** | Domain allowlist prevents arbitrary origins from using the verification endpoint. No DB access — purely proxies to Cloudflare's siteverify API. Minimal attack surface. |

---

## Functions Explicitly NOT Bypassed

The following functions are configured with `verify_jwt = true` or use the default (true):

| Function | Config | Notes |
|---|---|---|
| `agents` | explicit `true` | Authenticated user operations |
| `retell-dial` | explicit `true` | Authenticated call initiation |
| `guard-tests` | explicit `true` | Test harness behind auth |
| `smoke-tests` | explicit `true` | Health checks behind auth |
| `voice-demo-health` | explicit `true` | Demo health behind auth |
| `test-suitecrm-connection` | explicit `true` | Admin CRM testing |
| `suitecrm-sync` | explicit `true` | CRM sync (called by worker with service-role Bearer token) |
| `crm-admin` | explicit `true` | Admin CRM management |
| `send-test-email` | explicit `true` | Admin email testing |
| `generate-signed-url` | explicit `true` | **Token issuer** for `secure-resource-access` |
| All other functions | default `true` | Standard authenticated access |

---

## Flagged Issues

_None. All previously flagged issues have been resolved._

---

## Change Log

| Date | Change | Before → After |
|---|---|---|
| 2026-02-10 | Initial audit + `sms-webhook` added to bypass allowlist | 6 → 7 |
| 2026-02-10 | `retell-webhook-enhanced` deleted (dead code, no sig verification) — closes U2/U4 | — |

---

## Review Cadence

This allowlist **must** be reviewed:
- When any new Edge Function is added
- When any function's `verify_jwt` setting is changed in `config.toml`
- Quarterly as part of security hygiene reviews

Any addition to this list requires a PR review with security sign-off.
