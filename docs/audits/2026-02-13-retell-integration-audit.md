# Retell Integration Deep-Dive Audit (Closed Beta Gate)

Date: 2026-02-13  
Repo: `floodsys/tulora-growth-engine`  
Branch: `main`  
Mode: Read-only audit findings documented; this file created after explicit user approval.

## Executive Summary
- Closed beta decision for Retell integration alone: **NO-GO**.
- Highest risk concentration is in webhook reliability + idempotency + tenant-safe write behavior.
- Signature verification is present and ordered correctly before side effects, but key-type compliance with Retell webhook-badge requirement is **UNKNOWN**.
- Public/anon call-init paths (`retell-outbound`, `retell-webcall-create`) are reachable from public UI flows and do not enforce user/org auth in-function.

## Method
- Static code audit with evidence-by-file/line.
- Commands run:
  - `rg -n "retell|Retell|retell-sdk|retell-client-js-sdk|x-retell-signature|call_analyzed|call_ended|call_started|transcript_updated|transfer_" .`
  - `deno test --allow-env --no-check supabase/functions/_shared/__tests__/retellWebhookSignature.test.ts` (PASS)
  - `npm run -s test:ci -- src/__tests__/retell-calls-contract.test.ts` (PASS)
  - `deno check supabase/functions/retell-agents-publish/index.ts` (FAIL)
  - `deno check supabase/functions/retell-webhook/index.ts` (FAIL)
  - `deno check supabase/functions/retell-webcall-create/index.ts` (FAIL)

## Phase 1 - System Map

### Retell touchpoints
- Inbound webhook endpoint:
  - `supabase/functions/retell-webhook/index.ts`
- Call/web-call creation endpoints:
  - `supabase/functions/retell-webcall-create/index.ts`
  - `supabase/functions/retell-outbound/index.ts`
  - `supabase/functions/retell-dial/index.ts`
  - `supabase/functions/retell-dial-outbound/index.ts`
  - `supabase/functions/retell-test-call/index.ts`
- Frontend web-call SDK use:
  - `src/components/BrowserCallModal.tsx` (uses `retell-client-js-sdk`)
  - `src/hooks/useRetellWebCall.ts` (invokes `retell-webcall-create`)
  - `src/components/VoiceDemoCard.tsx`, `src/components/VoiceDemoCardSynthflow.tsx`, `src/components/TestCallsTab.tsx` (public/demo call flows)
- Persistence and org mapping:
  - `supabase/migrations/20250913162231_1ff5a60f-9861-4645-91ae-0b04f04ddcd8.sql` (`retell_calls`)
  - `supabase/migrations/20250913160549_b1279d60-6643-4897-9b52-423955c115c0.sql` (`retell_agents`)
  - `supabase/migrations/20260211030000_canonicalize_schema_and_rls.sql` (`is_org_member`)
- Config/env points:
  - `supabase/functions/_shared/env.ts` (`RETELL_API_KEY`, `RETELL_WEBHOOK_SECRET`)
  - `supabase/config.toml` (`[functions.retell-webhook] verify_jwt = false`)

### Retell component -> location -> purpose -> risk
| Component | Location | Purpose | Risk |
|---|---|---|---|
| Webhook ingress | `supabase/functions/retell-webhook/index.ts` | Receive/process Retell events | P0 |
| Signature verify util | `supabase/functions/_shared/retellSignature.ts` | Verify `x-retell-signature` | P0 |
| Web-call token creation | `supabase/functions/retell-webcall-create/index.ts` | Create access token for browser calls | P0 |
| Outbound dial (demo) | `supabase/functions/retell-outbound/index.ts` | Place outbound phone call | P0 |
| Authenticated dial | `supabase/functions/retell-dial/index.ts` | Authenticated call initiation | P1 |
| Call detail retrieval | `supabase/functions/retell-calls-get/index.ts` | Fetch DB + Retell call details | P1 |
| Agent publish | `supabase/functions/retell-agents-publish/index.ts` | Push config/webhook URL to Retell | P0 |

## Phase 2 - Webhook Security Correctness (P0)

### Finding 2.1 - Signature validation exists and is ordered correctly
Evidence:
- Raw body captured before parse: `supabase/functions/retell-webhook/index.ts:270-272`
- Signature header checked: `supabase/functions/retell-webhook/index.ts:275`
- Missing signature rejected 401: `supabase/functions/retell-webhook/index.ts:278-285`
- Verification call: `supabase/functions/retell-webhook/index.ts:302`
- Invalid signature rejected 401: `supabase/functions/retell-webhook/index.ts:305-313`
- JSON parse only after verify: `supabase/functions/retell-webhook/index.ts:318-320`

### Finding 2.2 - Verification implementation is custom HMAC, not Retell SDK helper
Evidence:
- Uses local helper `verifyWebhookSignature`: `supabase/functions/retell-webhook/index.ts:5`, `:302`
- Helper computes HMAC-SHA256 manually: `supabase/functions/_shared/retellSignature.ts:39-61`
- Secret source is `RETELL_WEBHOOK_SECRET`: `supabase/functions/retell-webhook/index.ts:290`

Assessment:
- **UNKNOWN** whether configured secret is a Retell webhook-badge API key as required by Retell docs.
- Validation step: verify the production secret type in Retell dashboard/API key inventory and run an SDK-helper parity test.

### Finding 2.3 - Optional IP allowlisting not implemented in webhook handler
Evidence:
- No `requireOrgIpAllowed` call in `supabase/functions/retell-webhook/index.ts`.
- IP allowlist utility exists generally: `supabase/functions/_shared/org-guard.ts:212`.

Assessment:
- Optional hardening only; primary control remains signature verification.
- Infrastructure allowlist state: **UNKNOWN**.

## Phase 3 - Reliability Constraints + Idempotency (P0/P1)

### Finding 3.1 - Handler does inline processing before success response
Evidence:
- Processes event synchronously: `supabase/functions/retell-webhook/index.ts:323`
- Returns success after processing: `supabase/functions/retell-webhook/index.ts:325`

Risk:
- Can breach Retell 10s timeout during DB slowness and trigger retries.

### Finding 3.2 - Out-of-order event handling is not resilient
Evidence:
- `call_started` uses upsert: `supabase/functions/retell-webhook/index.ts:130`
- `call_ended` uses update-only: `supabase/functions/retell-webhook/index.ts:154-156`
- `call_analyzed` uses update-only: `supabase/functions/retell-webhook/index.ts:181-183`

Risk:
- If `call_ended`/`call_analyzed` arrives before `call_started`, updates can no-op.
- Late `call_started` upsert can overwrite terminal status/fields.

### Finding 3.3 - No transactional event-level idempotency ledger for Retell events
Evidence:
- No `retell_call_events` table found.
- Stripe-specific idempotency table exists (`processed_webhook_events` with `stripe_event_id`): `supabase/migrations/20250907194952_3ddfdd91-5b74-4a5f-8062-43588b196899.sql:158-165`
- Generic `webhook_events` table exists but webhook function does not write to it: `supabase/migrations/20250914215526_ac7c47c1-c4eb-4ecf-a805-a5790838817e.sql:14-21`

Risk:
- Duplicate `call_ended` / `call_analyzed` deliveries are not deduped at event granularity.

## Phase 4 - Event Taxonomy + Routing (P1)

### Finding 4.1 - Supported events in code
Evidence:
- Switch handles `call_started`, `call_ended`, `call_analyzed`, `analysis_completed`: `supabase/functions/retell-webhook/index.ts:225-234`
- Unknown events go to generic path: `supabase/functions/retell-webhook/index.ts:236-238`

### Finding 4.2 - Subscription configuration (agent publish)
Evidence:
- Publish code sets `webhook_url`: `supabase/functions/retell-agents-publish/index.ts:174`
- No explicit `webhook_events` field in payload construction: `supabase/functions/retell-agents-publish/index.ts:130-160`

Assessment:
- Whether dashboard/account-level default events are correctly configured is **UNKNOWN**.

### Finding 4.3 - Agent publish function has runtime/type defects
Evidence:
- `resolveWebhookTarget` referenced without import: `supabase/functions/retell-agents-publish/index.ts:169`
- `corrId` referenced but undefined: `supabase/functions/retell-agents-publish/index.ts:175`, `:312`
- Confirmed by `deno check` errors.

Risk:
- P0 if publish path is used for production agent webhook setup.

## Phase 5 - End-to-End Call -> Persisted Outcome

### Finding 5.1 - Retell Get Call retrieval is present
Evidence:
- Fetches call details from Retell: `supabase/functions/retell-calls-get/index.ts:103-113`
- Fetches transcript URL if present: `supabase/functions/retell-calls-get/index.ts:116-125`
- Handles recording URL/signed URL path: `supabase/functions/retell-calls-get/index.ts:130-145`

### Finding 5.2 - Scrubbed variants/public logs usage not found
Evidence:
- No code usage found for `public_log_url`, `transcript_object`, `transcript_with_tool_calls`, scrubbed fields in Retell handlers.

Assessment:
- **UNKNOWN** if product intentionally excludes these fields or relies on dashboard/manual access.

### Finding 5.3 - Durable storage exists but partial
Evidence:
- `retell_calls` includes `call_id`, `organization_id`, `agent_id`, timestamps, `recording_signed_url`, `transcript_summary`, `analysis_json`: `supabase/migrations/20250913162231_...sql:4-23`

Gap:
- Full transcript is fetched ad hoc (not durably stored in same table).
- Retention policy specific to `retell_calls` not explicitly found (general org retention exists for activity logs).

## Phase 6 - Multi-tenant Isolation (P0)

### Finding 6.1 - Positive controls present
Evidence:
- `retell_calls` RLS enabled and org-member policies: `supabase/migrations/20250913162231_...sql:40-66`
- `is_org_member` enforces `auth.uid()` + `seat_active`: `supabase/migrations/20260211030000_canonicalize_schema_and_rls.sql:48-59`

### Finding 6.2 - Webhook write predicates do not include organization_id
Evidence:
- Organization derived from `agent_id`: `supabase/functions/retell-webhook/index.ts:216`
- Updates filtered only by `call_id`: `supabase/functions/retell-webhook/index.ts:155`, `:182`, `:202`
- Service-role client bypasses RLS: `supabase/functions/retell-webhook/index.ts:255-258`

Risk:
- P0 tenant-isolation weakness in webhook mutation path.

## Phase 6b - Retell web-call path (if shipped)

### Finding 6b.1 - Server-side token creation exists
Evidence:
- Retell API call done server-side with bearer key: `supabase/functions/retell-webcall-create/index.ts:200-204`
- Frontend uses returned access token in SDK: `src/components/BrowserCallModal.tsx:167-169`

### Finding 6b.2 - Missing authz in `retell-webcall-create`
Evidence:
- No `supabase.auth.getUser()` or org membership checks in function file.
- Uses slug->env mapping only: `supabase/functions/retell-webcall-create/index.ts:107`, `:136-143`.

Risk:
- P0 if endpoint is exposed to public traffic.

### Finding 6b.3 - Public demo path can call anon entrypoints
Evidence:
- Public route includes voice demo: `src/App.tsx:106`
- Voice demo calls `retell-webcall-create` and `retell-outbound`: `src/components/VoiceDemoCard.tsx:120`, `:187`
- Caller uses anon bearer from public config: `src/lib/api.ts:19`

## Event handling matrix
| Event | Handler location | Side effects | Idempotency key | Storage schema | Tenant mapping |
|---|---|---|---|---|---|
| `call_started` | `supabase/functions/retell-webhook/index.ts:115-140` | upsert call row (`started`) | `call_id` | `retell_calls` | derived via `agent_id` lookup |
| `call_ended` | `supabase/functions/retell-webhook/index.ts:142-165` | update completion fields | `call_id` only | `retell_calls` | not in update predicate |
| `call_analyzed` | `supabase/functions/retell-webhook/index.ts:167-192` | update analysis/outcome fields | `call_id` only | `retell_calls` | not in update predicate |
| `analysis_completed` | `supabase/functions/retell-webhook/index.ts:233-234` | routed to analyzed handler | `call_id` only | `retell_calls` | same as above |
| unknown events (`transcript_updated`, `transfer_*`) | `supabase/functions/retell-webhook/index.ts:194-212` | generic raw data update | `call_id` only | `retell_calls` | not in update predicate |

## Idempotency design status
Current:
- Unique call row by `call_id` exists (`retell_calls.call_id UNIQUE`).
- No event-level dedupe key `(call_id,event_type)` used in webhook processing.

Recommended target design:
- Add `retell_call_events`:
  - columns: `call_id`, `event_type`, `payload_hash`, `received_at`, `processed_at`, `processing_status`, `error`
  - unique constraint: `(call_id, event_type, payload_hash)` (or minimum `(call_id, event_type)`)
- Transactional flow:
  1. Insert event ledger row (dedupe gate)
  2. Upsert/merge `retell_calls` by `(call_id, organization_id)`
  3. Enqueue heavy post-processing via outbox
  4. Return fast 2xx/204

## Security checklist
| Control | Status | Evidence |
|---|---|---|
| `x-retell-signature` checked | PASS | `supabase/functions/retell-webhook/index.ts:275-281` |
| Raw body used for verify | PASS | `supabase/functions/retell-webhook/index.ts:270-272` |
| Invalid signature rejected pre-side-effects | PASS | `supabase/functions/retell-webhook/index.ts:305-313` |
| Retell SDK verify helper used | FAIL | custom helper only (`supabase/functions/_shared/retellSignature.ts`) |
| webhook-badge key usage proven | UNKNOWN | env name `RETELL_WEBHOOK_SECRET` only; key type not verifiable from repo |
| Fast 2xx under 10s | FAIL/P1 | processing awaited before response (`:323`, `:325`) |
| Duplicate delivery idempotency | PARTIAL | only row-level unique `call_id` |
| Tenant-safe update predicates | FAIL/P0 | updates by `call_id` only with service-role client |
| Optional IP allowlist | UNKNOWN/NOT IMPLEMENTED in webhook | no allowlist check in `retell-webhook` |

## Top 5 blockers (with evidence)
1. **P0 - Webhook out-of-order safety gap**
   - Evidence: `supabase/functions/retell-webhook/index.ts:130`, `:154`, `:181`
2. **P0 - Webhook tenant write scope is too broad**
   - Evidence: `supabase/functions/retell-webhook/index.ts:155`, `:182`, `:202`; service-role at `:255-258`
3. **P0/P1 - No immediate ack pattern for Retell 10s timeout/retries**
   - Evidence: `supabase/functions/retell-webhook/index.ts:323-325`
4. **P0 - Public/anon call-init exposure (`retell-outbound`/`retell-webcall-create`)**
   - Evidence: `src/components/VoiceDemoCard.tsx:120`, `:187`; `src/lib/api.ts:19`; `supabase/functions/retell-outbound/index.ts:103-107`
5. **P0 - Agent publish path reliability defects can break webhook/event config rollout**
   - Evidence: `supabase/functions/retell-agents-publish/index.ts:169`, `:175`, `:312`; `deno check` failure

## Test harness + verification plan

### A) Unit tests
- Signature verification behavior (valid/invalid):
  - `deno test --allow-env --no-check supabase/functions/_shared/__tests__/retellWebhookSignature.test.ts`
- Add webhook routing/schema tests (proposed):
  - `deno test --allow-env --no-check supabase/functions/retell-webhook/__tests__/routing.test.ts`
  - `deno test --allow-env --no-check supabase/functions/retell-webhook/__tests__/schema.test.ts`
- Frontend contract sanity:
  - `npm run -s test:ci -- src/__tests__/retell-calls-contract.test.ts`

### B) Integration tests (local/staging)
1. Start local services:
   - `supabase start`
   - `supabase functions serve retell-webhook retell-webcall-create retell-outbound`
2. Response-time test (<1s target):
   - `curl -s -o /dev/null -w "%{time_total}\n" -X POST http://127.0.0.1:54321/functions/v1/retell-webhook -H "content-type: application/json" -H "x-retell-signature: <sig>" --data "<payload>"`
3. Retry/duplicate simulation:
   - Post same `call_ended` payload 3 times; assert one durable terminal state.
4. Concurrency simulation:
   - Send same `call_id` payload with parallel requests (10+); assert no duplicate side effects and stable final row.

### C) Replay harness (artifact proposal, not committed)
- Proposed file: `scripts/retell/replay_webhook.py`
- Functions:
  - POST fixtures to webhook endpoint
  - `--repeat N`
  - `--concurrency M`
  - test-mode signature support (or verification stub mode)
- Example command:
  - `python scripts/retell/replay_webhook.py --url http://127.0.0.1:54321/functions/v1/retell-webhook --fixture fixtures/retell/call_ended.json --repeat 3 --concurrency 3 --secret test_webhook_key`

Fixture examples:
- `fixtures/retell/call_started.json`
```json
{"event":"call_started","call_id":"call_test_001","agent_id":"agent_test_001","direction":"inbound","from_number":"+15551230000","to_number":"+15557650000","start_timestamp":1739440000}
```
- `fixtures/retell/call_ended.json`
```json
{"event":"call_ended","call_id":"call_test_001","agent_id":"agent_test_001","end_timestamp":1739440060,"call_length":60,"recording_url":"https://example.invalid/rec.mp3","transcript_summary":"test summary"}
```
- `fixtures/retell/call_analyzed.json`
```json
{"event":"call_analyzed","call_id":"call_test_001","agent_id":"agent_test_001","call_analysis":{"call_successful":true,"call_summary":"positive outcome","user_sentiment":"positive"}}
```

### D) Smoke/E2E closed-beta scenario
1. Publish agent with webhook URL configured.
2. Place one test web call.
3. Receive `call_started` -> `call_ended` -> `call_analyzed`.
4. Verify `retell_calls` persisted terminal outcome once.
5. Verify UI/API (`retell-calls-list`, `retell-calls-get`) returns expected result.

## UNKNOWN items requiring explicit validation
1. Retell webhook key type (webhook-badge API key or not).
2. Deployed Retell dashboard webhook event subscription set.
3. Infrastructure IP allowlist for Retell source (`100.20.5.228`).
4. Production `verify_jwt` coverage for functions not explicitly declared in `supabase/config.toml`.
5. Real production webhook payload variants for `web_call` vs `phone_call` edge cases.

## Final Closed Beta Gate Decision
- **NO-GO** for Retell integration on current `main` until P0 issues above are remediated and replay/concurrency tests pass with evidence.
