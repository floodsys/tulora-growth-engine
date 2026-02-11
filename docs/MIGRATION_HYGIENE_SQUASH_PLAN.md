# Migration Hygiene Report — Squash Plan

> **Generated:** 2026-02-10  
> **Scope:** Read-only inventory + safe squash plan  
> **Total Migrations:** 226 files in `supabase/migrations/`  
> **Repo:** `floodsys/tulora-growth-engine` @ `bf75fad`  
> **STATUS: NO CODE CHANGES — READ-ONLY REPORT**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Group A — `plan_configs` / `org_stripe_subscriptions` Duplicates](#2-group-a--plan_configs--org_stripe_subscriptions-duplicates)
3. [Group B — `is_org_admin` / `is_org_member` Redefinitions](#3-group-b--is_org_admin--is_org_member-redefinitions)
4. [Group C — `handle_new_user_signup` Repeats](#4-group-c--handle_new_user_signup-repeats)
5. [Group D — `check_admin_access` Repeats](#5-group-d--check_admin_access-repeats)
6. [Group E — `log_activity_event` / `get_user_org_role` Repeats](#6-group-e--log_activity_event--get_user_org_role-repeats)
7. [Group F — `is_superadmin` / `bootstrap_superadmin` Repeats](#7-group-f--is_superadmin--bootstrap_superadmin-repeats)
8. [Group G — Table CREATE Duplicates](#8-group-g--table-create-duplicates)
9. [Seed INSERT Noise in Migrations](#9-seed-insert-noise-in-migrations)
10. [Recommended Approach](#10-recommended-approach)
11. [Execution Checklist](#11-execution-checklist)
12. [Risk Matrix](#12-risk-matrix)

---

## 1. Executive Summary

Across 226 migration files, we identified **7 major duplication groups** and **~100 migrations containing INSERT statements** (many of which are seed/demo data that belong in `seed.sql`). The key findings:

| Metric | Count |
|--------|-------|
| Total migrations | 226 |
| Migrations with INSERT statements | ~100 |
| `is_org_admin()` redefinitions | **14** |
| `is_org_member()` redefinitions | **12** |
| `check_admin_access()` redefinitions | **11** |
| `handle_new_user_signup()` redefinitions | **9** |
| `is_superadmin()` redefinitions | **7** |
| `get_user_org_role()` redefinitions | **5** |
| `log_activity_event()` redefinitions | **3** |
| `plan_configs` CREATE TABLE duplicates | **6** |
| `plan_configs` INSERT seed data | **10 migrations** |
| `org_stripe_subscriptions` CREATE TABLE duplicates | **5** |
| `organizations` CREATE TABLE duplicates | **5** |
| `organization_members` CREATE TABLE duplicates | **2** |
| `activity_logs` CREATE TABLE duplicates | **7** |
| `superadmins` CREATE TABLE duplicates | **3** |
| `agent_profiles` CREATE TABLE duplicates | **2** |
| `agent_profiles` seed INSERT duplicates | **14** |
| `superadmins` seed INSERT duplicates | **11** |
| `plan_configs` DELETE/cleanup in migrations | **4** |
| `plan_configs` UPDATE data in migrations | **6** |

**Recommendation:** Use **Approach A (No History Rewrite)** — add a single canonicalization migration that enforces the final function bodies, policies, and moves all seed data to `seed.sql`.

---

## 2. Group A — `plan_configs` / `org_stripe_subscriptions` Duplicates

### 2a. `plan_configs` Table Creation (6 migrations)

| # | Migration | Notes |
|---|-----------|-------|
| 1 | `20250823215634_36eb0f09` | First full CREATE + INSERT (trial, starter) |
| 2 | `20250823215738_ca8e8433` | Near-identical CREATE IF NOT EXISTS + INSERT |
| 3 | `20250823221638_8b531a97` | Same pattern, trial + plans |
| 4 | `20250823221751_84015fe7` | Same + RLS + trigger |
| 5 | `20250823221939_9bf762de` | Same pattern, adds trigger check |
| 6 | `20250823230711_322a4f0f` | Simpler version + different plan data |

**Impact:** All use `CREATE TABLE IF NOT EXISTS` so only the first one creates the table. However, each also INSERTs plan rows (often duplicating or conflicting). Later migrations (`20250906-20250907`) add `product_line` columns, insert `support_*`/`leadgen_*` plans, then DELETE core plans.

### 2b. `org_stripe_subscriptions` Table Creation (5 migrations)

| # | Migration | Notes |
|---|-----------|-------|
| 1 | `20250823215634_36eb0f09` | First CREATE IF NOT EXISTS |
| 2 | `20250823215738_ca8e8433` | Identical |
| 3 | `20250823221638_8b531a97` | Identical |
| 4 | `20250823221751_84015fe7` | Identical |
| 5 | `20250823221939_9bf762de` | Identical |

**Impact:** Harmless due to `IF NOT EXISTS`, but adds 4 completely redundant DDL statements.

### Canonical Final State

- **`plan_configs`** table: Defined in `20250823215634` with extensions from `20250906214035` (adds `product_line`, `stripe_setup_price_id`), `20250907224121` (adds `bill_setup_fee_in_stripe`), `20251127130000` (usage quota keys in `limits` JSONB).
- **`org_stripe_subscriptions`** table: Defined in `20250823215634`, no subsequent schema changes.

---

## 3. Group B — `is_org_admin` / `is_org_member` Redefinitions

### `is_org_admin()` — 14 definitions

| # | Migration | Key Change |
|---|-----------|------------|
| 1 | `20250818020027_39f19096` | Initial version |
| 2 | `20250818020044_fc8ba1b4` | Identical body |
| 3 | `20250818020110_f1e9bdc7` | Identical body |
| 4 | `20250823205304_2f2626c0` | Adds SECURITY DEFINER |
| 5 | `20250823205425_6961094e` | Identical to #4 |
| 6 | `20250823211555_10521c65` | Identical |
| 7 | `20250823211643_ff799c94` | "keeping same signature" |
| 8 | `20250823211720_10b9e764` | Identical |
| 9 | `20250823213357_c24d7712` | Adds org_role cast |
| 10 | `20250823223825_d2fe3833` | Identical to #9 |
| 11 | `20250823224342_a937c083` | Role enum handling |
| 12 | `20250823225611_c376d260` | Adds `SET search_path` |
| 13 | `20250824215823_778f684d` | Full search_path hardening |
| 14 | **`20250825051639_6f454540`** | ⭐ **CANONICAL** — final version |

### `is_org_member()` — 12 definitions

| # | Migration | Key Change |
|---|-----------|------------|
| 1 | `20250818020027_39f19096` | Initial |
| 2 | `20250818020044_fc8ba1b4` | Identical |
| 3 | `20250818020110_f1e9bdc7` | Identical |
| 4–8 | `202508232*` (5 migrations) | Various tweaks |
| 9–11 | `20250823224342–225611` | Role enum + search_path |
| 12 | **`20250824215823_778f684d`** | ⭐ **CANONICAL** — final version |

### Canonical Bodies (in effect after all 226 migrations)

**`is_org_admin(org_id uuid)`** — from `20250825051639`:
```sql
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
      AND user_id = auth.uid() 
      AND role = 'admin'::org_role 
      AND seat_active = true
  );
$$;
```

**`is_org_member(org_id uuid)`** — from `20250824215823`:
```sql
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
      AND user_id = auth.uid() 
      AND seat_active = true
  );
$$;
```

---

## 4. Group C — `handle_new_user_signup` Repeats

### 9 definitions across migrations

| # | Migration | Key Change |
|---|-----------|------------|
| 1 | `20250823225344_b2398b65` | Initial trigger function |
| 2 | `20250825025301_6aec03d2` | Adds org creation + agent seeding |
| 3 | `20250825025451_35799e3f` | Fixes agent seeding |
| 4 | `20250825025623_ceb235ec` | Fixes agent status |
| 5 | `20250825025731_2e6aeab2` | Fixes activity_logs column |
| 6 | `20250825025916_55b6b143` | Fixes target_type |
| 7 | `20250904215233_55d30c11` | Removes activity logging |
| 8 | `20250904215248_1fac0cd0` | Adds org details from metadata |
| 9 | **`20260121195400_fix_handle_new_user_signup`** | ⭐ **CANONICAL** — fixes `user_id` column, removes orphaned trigger |

### Canonical Body

From `20260121195400`: Uses `user_id` column (not `id`) for profiles, creates org with `industry`/`size_band`, seeds sample agent. **This is the function actually in effect.**

---

## 5. Group D — `check_admin_access` Repeats

### 11 definitions across migrations

| # | Migration | Key Change |
|---|-----------|------------|
| 1 | `20250824202029_f49a9957` | Initial (params: `org_id`, `user_id`) |
| 2 | `20250824202120_10a463cd` | Identical |
| 3 | `20250824215912_45f099cf` | Identical |
| 4 | `20250826041238_74924335` | Same params, same body |
| 5 | `20250826041312_45fb1ee7` | Renames to `p_org_id`, `p_user_id` |
| 6 | `20250826043554_27bc0c4d` | Identical to #5 |
| 7 | `20250826043744_2291178f` | Identical |
| 8 | `20250826051037_f764b476` | Adds superadmin bypass |
| 9 | `20250826051051_90e123e1` | Identical to #8 |
| 10 | `20250826051408_94f63277` | Identical |
| 11 | **`20250826231717_b3096fb5`** | ⭐ **CANONICAL** — membership canonicalization |

### Canonical Body

From `20250826231717` (part of Membership Canonicalization Migration):
```sql
CREATE OR REPLACE FUNCTION public.check_admin_access(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
  EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_user_id = COALESCE(p_user_id, auth.uid()))
  OR EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = COALESCE(p_user_id, auth.uid()) AND role = 'admin'::org_role AND seat_active = true)
  OR public.is_superadmin(COALESCE(p_user_id, auth.uid()));
$$;
```

---

## 6. Group E — `log_activity_event` / `get_user_org_role` Repeats

### `log_activity_event()` — 3 definitions

| # | Migration | Notes |
|---|-----------|-------|
| 1 | `20250824005843_334d0f67` | Initial |
| 2 | `20250824010003_c3b272b9` | Enhanced |
| 3 | **`20250824010027_8be2829f`** | ⭐ **CANONICAL** — full canonical event structure |

### `get_user_org_role()` — 5 definitions (with signature change!)

| # | Migration | Return Type |
|---|-----------|-------------|
| 1 | `20250824005843_334d0f67` | `TEXT` |
| 2 | `20250824010003_c3b272b9` | `TEXT` |
| 3 | `20250824010027_8be2829f` | `TEXT` |
| 4 | `20250826231717_b3096fb5` | **`JSONB`** (DROP + recreate) |
| 5 | **`20250826231938_0aaaa7f7`** | ⭐ **CANONICAL** — `JSONB` return |

> ⚠️ **Note:** `get_user_org_role` changed return type from `TEXT` to `JSONB` via explicit `DROP FUNCTION IF EXISTS` in migration `20250826231717`. The TEXT version was superseded.

---

## 7. Group F — `is_superadmin` / `bootstrap_superadmin` Repeats

### `is_superadmin()` — 7 definitions

| # | Migration | Key Change |
|---|-----------|------------|
| 1 | `20250824202029_f49a9957` | Initial, DEFAULT `auth.uid()` |
| 2 | `20250824202120_10a463cd` | Identical |
| 3 | `20250824204739_d3ea9dc6` | Identical |
| 4 | `20250825193201_c21df257` | Email allowlist check added |
| 5 | `20250825193234_07c41be6` | Identical to #4 |
| 6 | `20250907005309_dd8903e9` | DEFAULT changed to `NULL` |
| 7 | **`20250907010422_96748b3a`** | ⭐ **CANONICAL** — hardened, single source of truth |

### `bootstrap_superadmin()` — 2 definitions

| # | Migration | Notes |
|---|-----------|-------|
| 1 | `20250824204739_d3ea9dc6` | Initial |
| 2 | **`20250825010750_6d514d91`** | ⭐ **CANONICAL** |

---

## 8. Group G — Table CREATE Duplicates

| Table | # of CREATE statements | Canonical Source |
|-------|----------------------|------------------|
| `organizations` | 5 | `20250818020027` (extended by later ALTERs) |
| `organization_members` | 2 | `20250823205304` |
| `plan_configs` | 6 | `20250823215634` (extended by `20250906214035`) |
| `org_stripe_subscriptions` | 5 | `20250823215634` |
| `activity_logs` | 7 | `20250823215634` (replaced by `20250824005917`) |
| `superadmins` | 3 | `20250824204739` |
| `agent_profiles` | 2 | `20250818035727` |
| `profiles` | 1 | `20250904193823` (not duplicated) |
| `audit_log` | 1 | `20250824010542` (not duplicated) |

> All use `CREATE TABLE IF NOT EXISTS`, so only the first execution creates the table. The redundancy is harmless but adds migration noise.

---

## 9. Seed INSERT Noise in Migrations

### 9a. Pure Seed Data (should live in `seed.sql`)

| Category | Migrations | Description |
|----------|-----------|-------------|
| **plan_configs seed** | `20250823215634`, `20250823215738`, `20250823221638`, `20250823221751`, `20250823221939`, `20250823230711`, `20250906214301`, `20250906214452`, `20250907195744` | Plan tier definitions (trial, starter, pro, enterprise, support_*, leadgen_*) |
| **plan_configs cleanup** | `20250907201058`, `20250907202949`, `20250907203018`, `20250907203039`, `20250907203056` | DELETE/UPDATE core plans — 4 near-identical migrations |
| **plan_configs data updates** | `20251127130000` | Usage quota key updates |
| **superadmins seed** | `20250825182950`, `20250825183249`, `20250825183745`, `20250825193201`, `20250825193234`, `20250826042439` | Hardcoded UUID inserts (`a2e9b538...`) and email-based lookups |
| **agent_profiles seed** | `20250818041513`, `20250818041742`, `20250823225344`, `20250825025301-025916` (5 files) | Sample agent profiles for testing |
| **demo org seed** | `20250818020027`, `20250818020044` | Demo org creation with hardcoded data |

### 9b. Legitimate Seed Data Already in `seed.sql`

The current `seed.sql` is **well-structured** — it creates:
- Test user (`test-owner@example.com` / `password123`)
- Auth identity
- Profile update
- Organization update
- Superadmin bootstrap (email-based, no hardcoded UUIDs)

### 9c. Seed Data That Should Be Moved to `seed.sql`

| Data | Currently In | Move To |
|------|-------------|---------|
| Plan config tier definitions | 9+ migrations | `seed.sql` (idempotent UPSERT block) |
| Superadmin hardcoded UUIDs | 6 migrations | Already fixed in `20260211020000` |
| Sample agent profiles | 5+ migrations | `seed.sql` or `handle_new_user_signup` trigger (already handled) |

---

## 10. Recommended Approach

### ✅ **Approach A: No History Rewrite (RECOMMENDED)**

This is the **safest** approach. It does not rewrite git history, does not break any deployed database's `supabase_migrations.schema_migrations` table, and is fully additive.

#### Strategy

Add a **single new canonicalization migration** that:

1. **Re-asserts all canonical function bodies** using `CREATE OR REPLACE FUNCTION` for:
   - `is_org_admin(uuid)` — from `20250825051639`
   - `is_org_member(uuid)` — from `20250824215823`
   - `check_admin_access(uuid, uuid)` — from `20250826231717`
   - `handle_new_user_signup()` — from `20260121195400`
   - `log_activity_event(...)` — from `20250824010027`
   - `get_user_org_role(uuid, uuid)` — from `20250826231938`
   - `is_superadmin(uuid)` — from `20250907010422`
   - `bootstrap_superadmin(text)` — from `20250825010750`
   - `check_org_membership(uuid, uuid)` — from `20250826231717`
   - `check_org_ownership(uuid, uuid)` — from `20250826231717`

2. **Enforces final RLS policies** — re-drops and re-creates plan_configs policies.

3. **Adds a `-- CANONICALIZATION BOUNDARY` comment** so future reviewers know everything above this point has been reconciled.

4. **Moves seed INSERT data** — plan_configs seed data gets an idempotent UPSERT block in `seed.sql` (with `ON CONFLICT DO UPDATE`).

#### Why Not Approach B (History Rewrite)?

| Factor | Approach A | Approach B |
|--------|-----------|-----------|
| Risk to deployed DBs | ✅ None | ❌ Breaks `schema_migrations` |
| Git history integrity | ✅ Preserved | ❌ Force-push required |
| Team coordination | ✅ None needed | ❌ All devs must re-clone |
| CI/CD impact | ✅ None | ❌ Pipeline reconfiguration |
| Audit trail | ✅ Preserved | ❌ Lost |
| Complexity | ✅ Low | ❌ High |

### ⚠️ Approach B: History Rewrite (DEV-ONLY, NOT RECOMMENDED)

Only viable if:
- No production database exists yet
- All team members agree to force-push
- The `supabase_migrations.schema_migrations` table can be wiped

Would involve squashing the 226 migrations into ~20 logical migrations. **Do not pursue unless repo policy explicitly allows it.**

---

## 11. Execution Checklist

> **All items below are for a FUTURE implementation prompt.  
> This report makes NO code changes.**

### Phase 1: Seed Data Extraction
- [ ] Extract `plan_configs` seed INSERTs from migrations → add idempotent UPSERT block to `seed.sql`
- [ ] Verify `seed.sql` plan data matches the state after all 226 migrations (including DELETEs of core plans)
- [ ] Ensure `seed.sql` agent_profiles section aligns with `handle_new_user_signup` trigger behavior

### Phase 2: Canonicalization Migration
- [ ] Create `YYYYMMDDHHMMSS_canonicalize_functions_and_policies.sql`
- [ ] Include `CREATE OR REPLACE` for all 10 canonical functions listed in Section 10
- [ ] Include re-assertion of `plan_configs` RLS policy
- [ ] Add `-- CANONICALIZATION BOUNDARY` marker comment
- [ ] Verify idempotency: running the migration twice must not error

### Phase 3: Validation
- [ ] Run `supabase db reset` — must succeed with zero errors
- [ ] Run existing CI tests — must pass
- [ ] Run `scripts/check-rls-org-scope.cjs` — must pass
- [ ] Run `scripts/check-security-definer-search-path.cjs` — must pass
- [ ] Run `scripts/check-no-superadmin-uuid-constants.cjs` — must pass
- [ ] Verify function bodies in live DB match canonical definitions

### Phase 4: Documentation
- [ ] Update this report with "COMPLETED" status
- [ ] Add `MIGRATION_CONVENTIONS.md` documenting rules:
  - No seed data in migrations
  - Functions should only be redefined when the body actually changes
  - All `SECURITY DEFINER` functions must have `SET search_path`
  - New tables should not duplicate `CREATE TABLE IF NOT EXISTS` across migrations

---

## 12. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Canonicalization migration has a typo in function body | Medium | High | Copy-paste from last known-good migration, not manual rewrite |
| `seed.sql` plan_configs data doesn't match post-migration state | Medium | Medium | Query live DB to verify plan_configs state before writing seed |
| Removing seed INSERTs from migrations breaks fresh `db reset` | Low | High | Don't remove from migrations — only add canonical layer on top |
| Team members confused by duplicate migrations still existing | Low | Low | Document in MIGRATION_CONVENTIONS.md |
| Future migrations unknowingly re-duplicate a function | Medium | Low | Add CI lint check: `grep -c "CREATE OR REPLACE FUNCTION.*is_org_admin" | warn if > 1` |

---

## Appendix: Duplicate Migration File Index

<details>
<summary>Click to expand full file list by group</summary>

### `is_org_admin()` (14 files)
```
20250818020027_39f19096  20250818020044_fc8ba1b4  20250818020110_f1e9bdc7
20250823205304_2f2626c0  20250823205425_6961094e  20250823211555_10521c65
20250823211643_ff799c94  20250823211720_10b9e764  20250823213357_c24d7712
20250823223825_d2fe3833  20250823224342_a937c083  20250823225611_c376d260
20250824215823_778f684d  20250825051639_6f454540 ← CANONICAL
```

### `is_org_member()` (12 files)
```
20250818020027_39f19096  20250818020044_fc8ba1b4  20250818020110_f1e9bdc7
20250823205304_2f2626c0  20250823205425_6961094e  20250823211555_10521c65
20250823211643_ff799c94  20250823211720_10b9e764  20250823213357_c24d7712
20250823224342_a937c083  20250823225611_c376d260  20250824215823_778f684d ← CANONICAL
```

### `check_admin_access()` (11 files)
```
20250824202029_f49a9957  20250824202120_10a463cd  20250824215912_45f099cf
20250826041238_74924335  20250826041312_45fb1ee7  20250826043554_27bc0c4d
20250826043744_2291178f  20250826051037_f764b476  20250826051051_90e123e1
20250826051408_94f63277  20250826231717_b3096fb5 ← CANONICAL
```

### `handle_new_user_signup()` (9 files)
```
20250823225344_b2398b65  20250825025301_6aec03d2  20250825025451_35799e3f
20250825025623_ceb235ec  20250825025731_2e6aeab2  20250825025916_55b6b143
20250904215233_55d30c11  20250904215248_1fac0cd0  20260121195400 ← CANONICAL
```

### `is_superadmin()` (7 files)
```
20250824202029_f49a9957  20250824202120_10a463cd  20250824204739_d3ea9dc6
20250825193201_c21df257  20250825193234_07c41be6  20250907005309_dd8903e9
20250907010422_96748b3a ← CANONICAL
```

### `log_activity_event()` (3 files)
```
20250824005843_334d0f67  20250824010003_c3b272b9  20250824010027_8be2829f ← CANONICAL
```

### `get_user_org_role()` (5 files)
```
20250824005843_334d0f67  20250824010003_c3b272b9  20250824010027_8be2829f
20250826231717_b3096fb5  20250826231938_0aaaa7f7 ← CANONICAL (JSONB return)
```

### `plan_configs` table + seed (15+ files)
```
CREATE: 20250823215634  20250823215738  20250823221638  20250823221751  20250823221939  20250823230711
INSERT: 20250823215634  20250823215738  20250823221638  20250823221751  20250823221939  20250823230711
        20250906214301  20250906214452  20250907195744
ALTER:  20250906214035  20250907224121
UPDATE: 20250906214035  20250907201058  20251127130000
DELETE: 20250907202949  20250907203018  20250907203039  20250907203056
```

### `org_stripe_subscriptions` table (5 files)
```
20250823215634  20250823215738  20250823221638  20250823221751  20250823221939
```

### `superadmins` INSERT seed (6+ files)
```
20250825182950  20250825183249  20250825183745  20250825193201  20250825193234  20250826042439
```

</details>

---

*End of report. No code changes were made. This is a read-only inventory.*
