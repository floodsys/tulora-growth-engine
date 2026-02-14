# 2026-02-13 Production Readiness Audit

## Scope
- Repo: `floodsys/tulora-growth-engine`
- Branch: `main`
- Commit audited: `f01b556`
- Audit date: `2026-02-13`
- Mode: Read-only (no code or infra changes made)

## Executive Summary

**Decision: NO-GO for closed beta (as of commit `f01b556`).**

The repository has solid foundational work in CI hardening, webhook signature checks, and broad RLS coverage, but it still has **P0 blockers** that directly affect tenant security and core production flows.

### Top 5 blockers
1. **P0: Privilege escalation path in member management**. Authenticated users can perform service-role membership writes without explicit owner/admin authorization checks in function code (`supabase/functions/member-management/index.ts:21`, `supabase/functions/member-management/index.ts:97`, `supabase/functions/member-management/index.ts:118`, `supabase/functions/member-management/index.ts:143`).
2. **P0: `retell-agents-publish` has runtime-breaking defects** (undefined `corrId`, missing `resolveWebhookTarget` import, and incompatible `guardResult.organization?.settings` access) (`supabase/functions/retell-agents-publish/index.ts:169`, `supabase/functions/retell-agents-publish/index.ts:171`, `supabase/functions/retell-agents-publish/index.ts:175`, `supabase/functions/retell-agents-publish/index.ts:312`, `supabase/functions/_shared/org-guard.ts:7`).
3. **P0: Outbound voice entrypoint is effectively public to anon token holders and lacks org/user authorization checks** (`supabase/functions/retell-outbound/index.ts:14`, `supabase/functions/retell-outbound/index.ts:104`, `src/lib/api.ts:19`).
4. **P1: Retell webhook processing is not resilient to out-of-order event arrival** (`call_started` upsert, but `call_ended`/`call_analyzed` update-only) (`supabase/functions/retell-webhook/index.ts:130`, `supabase/functions/retell-webhook/index.ts:154`, `supabase/functions/retell-webhook/index.ts:181`).
5. **P1: Critical operational code paths still contain runtime bugs and integration mismatches** (`send-alert-notification` undefined `metadata`, `org-suspension` bad superadmin check order, `crm-admin` missing worker secret header, web-call payload mismatch) (`supabase/functions/send-alert-notification/index.ts:92`, `supabase/functions/org-suspension/index.ts:77`, `supabase/functions/crm-admin/index.ts:101`, `supabase/functions/suitecrm-sync-worker/index.ts:50`, `src/hooks/useRetellWebCall.ts:59`, `supabase/functions/retell-webcall-create/index.ts:107`).

## Method and Commands Run

### Inventory and mapping
- `git rev-parse --short HEAD` -> `f01b556`
- `Get-ChildItem`
- `Get-ChildItem -Recurse -Depth 3 -File -Include *.md,*.yml,*.yaml,*.sql | Select-Object -First 30 -ExpandProperty FullName`
- `rg -n "retell|Retell|stripe|webhook|supabase|RLS|policy|edge function|queue|worker|rate limit|replay|idempot" .`

### Validation and tests
- `npm run build` -> pass, with warnings:
  - duplicate switch case in `src/components/dashboard/UsageBilling.tsx:565`
  - large JS chunk warning
- `npm run test:ci` -> pass (`9` files passed, `1` skipped; `58` tests passed, `7` skipped)
- `deno test --allow-env --no-check supabase/functions/_shared/__tests__/retellWebhookSignature.test.ts` -> pass
- `node scripts/check-security-definer-search-path.cjs` -> pass
- `node scripts/check-rls-tautologies.cjs` -> pass (legacy allowlist acknowledged)
- `node scripts/check-rls-org-scope.cjs` -> pass
- `npx supabase db reset` -> pass on this run (`Finished supabase db reset on branch main.`)

### Database policy checks
- RLS enabled coverage:
  - `select count(*) as total_tables, count(*) filter (where c.relrowsecurity) as rls_enabled ...` -> `42 | 42`
- RLS tables with zero policies:
  - `memberships_deprecated_legacy | 0`
- Effective permissive policy clauses:
  - `demo_sessions` has `FOR ALL USING (true)`
  - `activity_logs` insert policy has `WITH CHECK (true)`

## System Map

### Frontend
- Stack: React + Vite + TypeScript (`package.json` scripts/deps, `vite.config.ts:10`).
- Supabase client uses public anon key (`src/integrations/supabase/client.ts:9`, `src/config/publicConfig.ts:4`).
- Frontend env expectations include `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_ENABLE_SENTRY`/`VITE_SENTRY_DSN` (`src/lib/env.ts:19`, `src/lib/sentry.ts:18`).

### Backend/API
- Primary backend: Supabase Edge Functions (Deno TypeScript) under `supabase/functions/*`.
- Auth model:
  - default `verify_jwt = true` unless explicitly bypassed
  - bypassed functions documented in `supabase/config.toml:39` and `docs/security/jwt-bypass.md:1`.

### Supabase schema, migrations, and RLS
- Migrations under `supabase/migrations/` (227+ files scanned by checks).
- Effective DB state confirms all public tables have RLS enabled (`42/42`), but one RLS-enabled table has no policies (`memberships_deprecated_legacy`).
- Example org-scoped policies verified in runtime `pg_policies` for `organizations`, `organization_members`, `retell_agents`, `retell_calls`, `org_stripe_subscriptions`.

### Stripe integration
- Checkout: `create-org-checkout` (`supabase/functions/create-org-checkout/index.ts:17`).
- Portal: `org-customer-portal` (`supabase/functions/org-customer-portal/index.ts:16`).
- Webhook: `org-billing-webhook` with signature verification and idempotency table (`supabase/functions/org-billing-webhook/index.ts:152`, `supabase/functions/org-billing-webhook/index.ts:249`).

### Retell integration
- Webhook handler with required signature verification (`supabase/functions/retell-webhook/index.ts:275`).
- Agent publish path (`supabase/functions/retell-agents-publish/index.ts:13`) currently has runtime defects.
- Outbound and webcall creation endpoints exist (`supabase/functions/retell-outbound/index.ts`, `supabase/functions/retell-webcall-create/index.ts`).

### Background jobs and queues
- CRM queue worker pipeline:
  - outbox enqueue/retry logic in `suitecrm-sync` (`supabase/functions/suitecrm-sync/index.ts:469`)
  - worker execution in `suitecrm-sync-worker` (`supabase/functions/suitecrm-sync-worker/index.ts:198`)
  - manual retry trigger in `crm-admin` (`supabase/functions/crm-admin/index.ts:86`)
- Retention and usage rollups implemented as functions:
  - `retention-cleanup` (`supabase/functions/retention-cleanup/index.ts:26`)
  - `usage-rollup-job` (`supabase/functions/usage-rollup-job/index.ts:65`)
  - **No scheduler wiring found in repo for these functions** (UNKNOWN for production infra scheduler).

### CI/CD and environments
- Workflows under `.github/workflows/*` include smoke tests, follow-up issue workflow, RLS checks, migration hygiene, secret scan.
- Production smoke workflow:
  - concurrency guard (`.github/workflows/smoke-tests.yml:10`)
  - explicit read permissions (`.github/workflows/smoke-tests.yml:14`)
  - Node 20 (`.github/workflows/smoke-tests.yml:34`)
- Follow-up workflow opens/updates failure issue by title (`.github/workflows/production-smoke-tests-followup.yml:133`).
- Multiple workflows still pinned to Node 18 (`.github/workflows/build-version-check.yml:23`, `.github/workflows/invite-tests.yml:39`, `.github/workflows/migration-hygiene.yml:21`, `.github/workflows/rls-regression-tests.yml:26`, `.github/workflows/superadmin-auth-tests.yml:28`, `.github/workflows/lint-deprecated-routes.yml:20`).

## Readiness Scorecard (0-3)

Scale:
- `0` = not ready
- `1` = major gaps/blockers
- `2` = beta-capable with known risks
- `3` = production-ready

| Category | Score | Confidence | Evidence Summary |
|---|---:|---|---|
| 1) Core product features | 1 | High | Voice/agent flows exist, but `retell-agents-publish` has runtime defects that can break publishing (`supabase/functions/retell-agents-publish/index.ts:169`, `supabase/functions/retell-agents-publish/index.ts:312`). |
| 2) API + integrations | 1 | High | Stripe webhook path is strong; Retell webhook signature check exists; outbound/webcall auth/contracts have serious gaps (`supabase/functions/retell-outbound/index.ts:14`, `src/hooks/useRetellWebCall.ts:59`). |
| 3) Security | 1 | High | RLS broad coverage is good (`42/42`), but member-management privilege escalation is a P0 (`supabase/functions/member-management/index.ts:97`). |
| 4) Reliability | 1 | High | Stripe webhook idempotent; Retell webhook not resilient to out-of-order events; missing endpoint-level rate limits on critical voice paths. |
| 5) Observability | 1 | High | Logging exists, but includes sensitive payload/header logs; admin observability dashboards still include mock metrics (`src/pages/admin/ObservabilityDashboard.tsx:68`, `src/components/admin/WebhookDashboard.tsx:100`). |
| 6) Delivery (CI/CD/env) | 2 | Medium | Smoke + follow-up issue workflows are in place; DB reset and security checks pass; version drift and no explicit rollback automation remain. |
| 7) UX + operational readiness | 1 | Medium | Onboarding idempotency is good; invite "full" CI suite is placeholder (`scripts/run-invite-tests.js:177`); admin/ops defects remain. |
| 8) Compliance-ish beta basics | 1 | Medium | Privacy/security UI exists, but legal routes are missing, consent enforcement appears UI-only, and claims are not repo-verifiable. |

## Risk Register

### P0

| ID | Risk | Impact | Likelihood | Evidence | Fix Plan |
|---|---|---|---|---|---|
| P0-1 | Privilege escalation in member management | Unauthorized member add/remove/role changes across tenant -> account takeover within org | High | Service-role client + no explicit admin/owner check in function before writes (`supabase/functions/member-management/index.ts:21`, `supabase/functions/member-management/index.ts:97`, `supabase/functions/member-management/index.ts:118`, `supabase/functions/member-management/index.ts:143`). Guard only checks org status (`supabase/functions/_shared/org-guard.ts:57`). | Add explicit `is_org_admin/is_org_owner` authorization gate before any membership mutation. Fail closed. Add integration tests for non-admin callers. |
| P0-2 | `retell-agents-publish` runtime-breaking defects | Agent publish failures in core product path | High | `resolveWebhookTarget` used without import (`supabase/functions/retell-agents-publish/index.ts:169`), `corrId` referenced but undefined (`supabase/functions/retell-agents-publish/index.ts:175`, `supabase/functions/retell-agents-publish/index.ts:312`), `organization?.settings` not present in guard type (`supabase/functions/_shared/org-guard.ts:7`). | Fix imports/variables/types, add unit test for publish payload assembly and smoke test invocation. |
| P0-3 | Outbound call endpoint lacks tenant/user authorization and rate controls | Abuse can trigger paid telephony calls and cost blowouts | High | `retell-outbound` has no auth/user/org membership checks (`supabase/functions/retell-outbound/index.ts:94` onward). Caller helper uses anon bearer (`src/lib/api.ts:19`). CORS is not used as hard authorization (`supabase/functions/retell-outbound/index.ts:25`). | Require authenticated user JWT + org membership check + per-org and per-user rate limiting + destination allowlist. Add abuse tests (429 expected). |

### P1

| ID | Risk | Impact | Likelihood | Evidence | Fix Plan |
|---|---|---|---|---|---|
| P1-1 | Retell webhook out-of-order event handling gap | Lost or incomplete call records on retries/reordering | Medium | `call_started` upsert (`supabase/functions/retell-webhook/index.ts:130`) but `call_ended` and `call_analyzed` are update-only (`supabase/functions/retell-webhook/index.ts:154`, `supabase/functions/retell-webhook/index.ts:181`). | Convert all event handlers to idempotent upsert/merge by `call_id`, persist event timestamps/versioning. |
| P1-2 | CRM retry trigger and worker auth mismatch | Manual retry calls may silently fail to process queue | Medium | `crm-admin` trigger fetch omits `x-internal-secret` (`supabase/functions/crm-admin/index.ts:101`), worker requires it (`supabase/functions/suitecrm-sync-worker/index.ts:50`). | Include required internal secret header and add end-to-end retry test. |
| P1-3 | Runtime bugs in admin/security operations | Broken incident tooling and alerting | Medium | Undefined `metadata` in alert function (`supabase/functions/send-alert-notification/index.ts:92`); superadmin check references undefined `userData` early (`supabase/functions/org-suspension/index.ts:77`). | Fix execution order/variables, add tests for these functions. |
| P1-4 | Sensitive request logging in production paths | Increased risk of PII/token leakage via logs | Medium | Full headers and request data logged (`supabase/functions/agents/index.ts:28`, `supabase/functions/agents/index.ts:51`, `supabase/functions/retell-webhook/index.ts:251`, `supabase/functions/retell-webhook/index.ts:320`). | Implement log redaction utility and restrict payload logging by env + sampling. |
| P1-5 | Incomplete rate limiting on critical endpoints | Abuse risk and noisy-neighbor instability | Medium | Contact-sales has rate limiting (`supabase/functions/contact-sales/index.ts:703`) but retell-outbound/webcall/member-management lack comparable checks. | Add central limiter for high-cost and mutable endpoints (429 + retry-after). |
| P1-6 | CI test coverage gap in invite full mode | False confidence in invitation regressions | Medium | `invite-tests` runs `--mode=full` (`.github/workflows/invite-tests.yml:71`) but script states full suite not implemented (`scripts/run-invite-tests.js:177`). | Implement full-mode tests or rename workflow/mode to reflect real scope. |
| P1-7 | Observability dashboards use mock metrics | Operational blind spots during incidents | Medium | Mock values in admin dashboards (`src/pages/admin/ObservabilityDashboard.tsx:68`, `src/pages/admin/ObservabilityDashboard.tsx:70`, `src/components/admin/WebhookDashboard.tsx:100`). | Replace mock fields with real metrics from telemetry tables/services and add alerts. |
| P1-8 | Node version drift across workflows | Inconsistent CI behavior vs production runtime | Medium | Smoke uses Node 20 (`.github/workflows/smoke-tests.yml:34`), several workflows still Node 18 (`.github/workflows/build-version-check.yml:23`, etc.). | Standardize all workflows on Node 20. |

### P2

| ID | Risk | Impact | Likelihood | Evidence | Fix Plan |
|---|---|---|---|---|---|
| P2-1 | Legal footer links route to missing pages | Poor trust/compliance posture in beta onboarding | High | Footer links include `/privacy`, `/terms`, `/security`, `/gdpr`, `/dpa` (`src/components/Footer.tsx:30`) but router has no matching routes (`src/App.tsx:122`). | Add legal pages/routes or remove links until available. |
| P2-2 | Compliance/security claims not verifiable from repo | Potential overstatement risk | Medium | Claims like “SOC 2 Type II” and GDPR in UI (`src/components/Security.tsx:9`, `src/components/Footer.tsx:102`) without auditable artifacts in repo. | Add evidence links/attestation docs or adjust wording for beta. |
| P2-3 | Consent control appears UI-level only | Regulatory risk for call recording jurisdictions | Medium | Consent toggle in UI (`src/components/AgentPrivacySettings.tsx:305`), no direct enforcement found in Retell webhook/store paths. | Add server-side consent checks before recording persistence and jurisdiction-based prompts. |
| P2-4 | Build quality warnings | Reduced maintainability and perf headroom | Medium | Duplicate switch case warning (`src/components/dashboard/UsageBilling.tsx:565`) and large bundle warning from build. | Clean dead branches, split chunks, enforce lint rule for duplicate case labels. |

## Security and Data Isolation Deep Dive

### What is good
- Runtime RLS coverage is broad (`42/42` public tables have RLS enabled).
- Org-scoped policies are present on key tables (`organizations`, `organization_members`, `retell_agents`, `retell_calls`, `org_stripe_subscriptions`, `webhook_events`) via `is_org_member`/`is_org_admin`.
- SECURITY DEFINER search_path checks pass (`node scripts/check-security-definer-search-path.cjs`).

### What is still risky
- `memberships_deprecated_legacy` is RLS-enabled but has zero policies (deny-all in practice; still schema hygiene debt).
- Legacy permissive policy artifacts still exist (`demo_sessions FOR ALL USING (true)` in migrations and runtime policy table).
- Function-level service-role use must be strictly paired with authorization checks; this is currently violated in `member-management`.

## Webhook Security Deep Dive

### Stripe
- Signature verification present (`supabase/functions/org-billing-webhook/index.ts:152`, `supabase/functions/org-billing-webhook/index.ts:165`).
- Idempotency implemented through `processed_webhook_events` (`supabase/functions/org-billing-webhook/index.ts:249`, `supabase/migrations/20250907194952_3ddfdd91-5b74-4a5f-8062-43588b196899.sql:158`).

### Retell
- Signature verification present and tested (`supabase/functions/retell-webhook/index.ts:275`, `supabase/functions/_shared/retellSignature.ts:32`, `supabase/functions/_shared/__tests__/retellWebhookSignature.test.ts:74`).
- Event ordering/idempotency incomplete for non-start events (P1).

## CI/CD and Environment Readiness

### Strengths
- Production smoke tests have concurrency guard and least-privileged permissions (`.github/workflows/smoke-tests.yml:10`, `.github/workflows/smoke-tests.yml:14`).
- Follow-up workflow can open/update failure issue with dedicated permissions (`.github/workflows/production-smoke-tests-followup.yml:12`).
- Secret scanning workflow with redaction is present (`.github/workflows/gitleaks.yml:24`).
- DB reset and Deno edge shared tests workflow exists (`.github/workflows/db-reset-deno-tests.yml:1`).

### Gaps
- Node version inconsistency across workflows.
- No explicit rollback automation discovered in workflows/docs.
- `.github/environments/*.yml` are documentation files; actual GitHub environment protection settings are **UNKNOWN** unless verified in GitHub UI.

## Product and Operational Readiness

### Onboarding and org flows
- `saveOrganization` has race/idempotency handling for org and membership creation (`src/lib/profile/saveOrganization.ts:108`).

### Billing readiness
- Primary org-scoped Stripe endpoints exist and are wired in frontend (`src/components/PricingTable.tsx:70`, `src/components/PricingTable.tsx:107`).
- Deprecated Stripe endpoints remain in repo but marked deprecated (`supabase/functions/create-stripe-checkout/index.ts:2`, `supabase/functions/stripe-customer-portal/index.ts:2`).

### Retell happy/unhappy path
- Happy path components and functions exist.
- Publish and webcall path defects currently threaten reliability (P0/P1).

### Admin tooling
- Org suspension flow exists with runbook (`docs/organization-status-runbook.md:1`), but function defect blocks confidence.
- Audit/export and log pathways exist (`supabase/functions/export-audit-logs/index.ts`).

## Beta Gate Checklist

| Gate | Validation command/test | Status | Current result |
|---|---|---|---|
| Build compiles | `npm run build` | PASS (with warnings) | Build succeeded; duplicate case and bundle-size warnings remain. |
| Unit/integration baseline | `npm run test:ci` | PASS | 58 passed, 7 skipped. |
| Retell signature verification tests | `deno test --allow-env --no-check supabase/functions/_shared/__tests__/retellWebhookSignature.test.ts` | PASS | 2 suites passed. |
| SECURITY DEFINER hardening | `node scripts/check-security-definer-search-path.cjs` | PASS | 0 violations. |
| RLS tautology check | `node scripts/check-rls-tautologies.cjs` | PASS (legacy allowlist) | No active violations. |
| RLS org-scope regression | `node scripts/check-rls-org-scope.cjs` | PASS | Checks passed for voice/call tables. |
| Migrations replay cleanly | `npx supabase db reset` | PASS | Completed successfully on this audit run. |
| Key tables have RLS | `psql ... relrowsecurity query` | PASS | 42/42 tables have RLS enabled. |
| No critical auth bypass on member mutation | Static review of `member-management` | FAIL | Missing owner/admin authorization gate before service-role writes. |
| Retell publish flow runtime sanity | Static review + invoke smoke | FAIL | Undefined symbols/import/type mismatch in publish function. |
| Outbound call abuse controls | Static review of `retell-outbound` and caller auth | FAIL | No org/user authorization checks, no rate limiting. |
| Webhook out-of-order resilience | Static review of retell webhook handlers | FAIL | `ended/analyzed` are update-only; missing upsert/merge behavior. |
| Full invite regression coverage in CI | `node scripts/run-invite-tests.js --mode=full` behavior | FAIL | Placeholder suite intentionally fails/unfinished. |
| Production observability signal quality | Review admin observability components | FAIL | Mock metrics still present. |
| Legal and compliance surface in app routes | route and footer link review | FAIL | Legal links exist but routes missing. |

## Prioritized Backlog (PR-Sized, No PRs Created)

| Priority | PR-sized work item | Effort | Suggested owner | Acceptance criteria |
|---|---|---|---|---|
| 1 | Add strict role authorization to `member-management` | M | Backend/Security | Non-admin token cannot add/remove/change roles; tests cover owner/admin/member/anon cases. |
| 2 | Repair `retell-agents-publish` runtime defects and add tests | M | Voice Integrations | Publish endpoint runs clean, webhook target resolution works, response includes valid correlation id. |
| 3 | Harden `retell-outbound` and `retell-webcall-create` with auth + org checks + rate limiting | L | Backend/Voice + Security | Only authorized org members can call; anon abuse blocked; 429 behavior tested. |
| 4 | Make Retell webhook handlers idempotent for all event orders | M | Voice Integrations | Replay and out-of-order events preserve correct terminal call state. |
| 5 | Fix `crm-admin` -> worker trigger auth header mismatch | S | CRM Integrations | Retry action successfully invokes worker using required secret. |
| 6 | Fix runtime bugs in `send-alert-notification` and `org-suspension` | S | Backend Ops | Functions pass smoke tests for valid and invalid inputs. |
| 7 | Introduce log redaction standard for edge functions | M | Platform/SRE | No raw auth headers, signatures, or full webhook payloads in logs. |
| 8 | Replace mock observability metrics with real telemetry queries | M | SRE/Frontend | Dashboard response time/uptime/failure metrics are computed from real data. |
| 9 | Unify CI workflows on Node 20 | S | DevEx | All workflows use Node 20; CI passes unchanged test suite. |
| 10 | Implement true invite “full” CI suite or relabel mode | M | QA/Backend | `--mode=full` executes real invite lifecycle tests and passes when healthy. |
| 11 | Add legal pages/routes and compliance copy review | M | Product/Legal + Frontend | Footer links resolve to real pages with approved content. |
| 12 | Define and document rollback playbook + optional automation | M | DevOps | Runbook includes app rollback, function rollback, migration rollback/restore strategy. |

## UNKNOWN Items (Requires External Verification)

The following cannot be reliably verified from repo contents alone:

1. **Stripe dashboard runtime configuration**:
   - Confirm live webhook endpoint URL, subscribed events, and secret rotation policy.
   - Confirm endpoint points to `org-billing-webhook` in production project.
2. **Retell dashboard runtime configuration**:
   - Confirm webhook URL, signing secret configuration, and retry behavior settings.
3. **GitHub repository default `GITHUB_TOKEN` setting**:
   - Repo-level default token permission change is not encoded in git files; verify in GitHub Settings.
4. **Production scheduler wiring**:
   - Verify whether `retention-cleanup` and `usage-rollup-job` are scheduled in Supabase/cron infrastructure.
5. **Incident response operations**:
   - On-call rota, paging channels, and escalation SLOs are not verifiable in repo.
6. **Compliance attestations**:
   - SOC2/GDPR claims in UI require external evidence package.

## Final Go/No-Go

**NO-GO**

Move to **GO** only after all three P0 items are fixed and validated by:
- automated tests covering auth/abuse paths,
- one end-to-end Retell publish/call flow rehearsal,
- and a re-run of the Beta Gate checklist with all P0/P1 security/reliability gates passing.
