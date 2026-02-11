-- =============================================================================
-- CRITICAL RLS FIX: Org-scoped access for voice_agents & call_logs
-- =============================================================================
-- Context:
--   voice_agents and call_logs previously had wide-open (tautology) policies (migration
--   20250828023148) which were later replaced with is_superadmin()-only policies
--   (migration 20250828044840). Neither table had organization_id, so access
--   was not scoped to organizations.
--
--   bookings was DROPPED in migration 20250828194049 — handled with IF EXISTS.
--
-- This migration:
--   1. Adds organization_id uuid to voice_agents and call_logs
--   2. Backfills call_logs.organization_id from voice_agents via agent_id join
--   3. Drops prior superadmin-only AND any tautology policies (fail-closed)
--   4. Creates org-scoped policies using organization_members (seat_active=true)
--   5. Superadmins retain full access via is_superadmin()
--   6. Rows with NULL organization_id are denied to non-superadmins (fail-closed)
--   7. Adds indexes on organization_id
--   8. All operations are idempotent (safe for db reset)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Add organization_id columns (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

-- voice_agents
DO $$
BEGIN
  IF to_regclass('public.voice_agents') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'voice_agents'
        AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE public.voice_agents
        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added organization_id to voice_agents';
    ELSE
      RAISE NOTICE 'voice_agents.organization_id already exists — skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Table voice_agents does not exist — skipping';
  END IF;
END$$;

-- call_logs
DO $$
BEGIN
  IF to_regclass('public.call_logs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'call_logs'
        AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE public.call_logs
        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added organization_id to call_logs';
    ELSE
      RAISE NOTICE 'call_logs.organization_id already exists — skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Table call_logs does not exist — skipping';
  END IF;
END$$;

-- bookings (may have been dropped — guard)
DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bookings'
        AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE public.bookings
        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added organization_id to bookings';
    ELSE
      RAISE NOTICE 'bookings.organization_id already exists — skipping';
    END IF;
  ELSE
    RAISE NOTICE 'Table bookings does not exist (dropped) — skipping';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Backfill organization_id where deterministic join path exists
-- ─────────────────────────────────────────────────────────────────────────────
-- call_logs.organization_id ← voice_agents.organization_id via call_logs.agent_id
-- voice_agents has NO FK to organizations; cannot backfill (left nullable, fail-closed)

DO $$
BEGIN
  IF to_regclass('public.call_logs') IS NOT NULL
     AND to_regclass('public.voice_agents') IS NOT NULL THEN
    UPDATE public.call_logs cl
    SET organization_id = va.organization_id
    FROM public.voice_agents va
    WHERE cl.agent_id = va.id
      AND va.organization_id IS NOT NULL
      AND cl.organization_id IS NULL;
    RAISE NOTICE 'Backfilled call_logs.organization_id from voice_agents via agent_id';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Ensure RLS is enabled
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF to_regclass('public.voice_agents') IS NOT NULL THEN
    ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
  END IF;
END$$;

DO $$ BEGIN
  IF to_regclass('public.call_logs') IS NOT NULL THEN
    ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END$$;

DO $$ BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Drop ALL existing policies on these tables (clean slate)
-- ─────────────────────────────────────────────────────────────────────────────

-- voice_agents — drop old tautology and superadmin-only policies
DROP POLICY IF EXISTS "admin_access_voice_agents"         ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_public_access"        ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_select_admin_only"    ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_insert_admin_only"    ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_update_admin_only"    ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_delete_admin_only"    ON public.voice_agents;
-- drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS "voice_agents_org_select"           ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_org_insert"           ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_org_update"           ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_org_delete"           ON public.voice_agents;

-- call_logs
DROP POLICY IF EXISTS "admin_access_call_logs"            ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_select_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_insert_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_update_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_delete_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_select"              ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_insert"              ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_update"              ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_delete"              ON public.call_logs;

-- bookings (may not exist)
DO $$ BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_access_bookings"       ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_select_admin_only"  ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_insert_admin_only"  ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_update_admin_only"  ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_delete_admin_only"  ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_org_select"         ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_org_insert"         ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_org_update"         ON public.bookings';
    EXECUTE 'DROP POLICY IF EXISTS "bookings_org_delete"         ON public.bookings';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Create org-scoped RLS policies
-- ─────────────────────────────────────────────────────────────────────────────
-- Policy logic:
--   USING: superadmin OR (organization_id IS NOT NULL AND user is active
--          member of that org via organization_members with seat_active=true)
--   WITH CHECK: same logic for INSERT/UPDATE
--   Rows with NULL organization_id → DENIED to non-superadmins (fail-closed)

-- ── voice_agents ────────────────────────────────────────────────────────────

CREATE POLICY "voice_agents_org_select" ON public.voice_agents
FOR SELECT USING (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = voice_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

CREATE POLICY "voice_agents_org_insert" ON public.voice_agents
FOR INSERT WITH CHECK (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = voice_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

CREATE POLICY "voice_agents_org_update" ON public.voice_agents
FOR UPDATE USING (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = voice_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
) WITH CHECK (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = voice_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

CREATE POLICY "voice_agents_org_delete" ON public.voice_agents
FOR DELETE USING (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = voice_agents.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

-- ── call_logs ───────────────────────────────────────────────────────────────

CREATE POLICY "call_logs_org_select" ON public.call_logs
FOR SELECT USING (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = call_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

CREATE POLICY "call_logs_org_insert" ON public.call_logs
FOR INSERT WITH CHECK (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = call_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

CREATE POLICY "call_logs_org_update" ON public.call_logs
FOR UPDATE USING (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = call_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
) WITH CHECK (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = call_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

CREATE POLICY "call_logs_org_delete" ON public.call_logs
FOR DELETE USING (
  public.is_superadmin()
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = call_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.seat_active = true
    )
  )
);

-- ── bookings (if table still exists) ────────────────────────────────────────

DO $$ BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    EXECUTE '
      CREATE POLICY "bookings_org_select" ON public.bookings
      FOR SELECT USING (
        public.is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = bookings.organization_id
              AND om.user_id = auth.uid()
              AND om.seat_active = true
          )
        )
      )';

    EXECUTE '
      CREATE POLICY "bookings_org_insert" ON public.bookings
      FOR INSERT WITH CHECK (
        public.is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = bookings.organization_id
              AND om.user_id = auth.uid()
              AND om.seat_active = true
          )
        )
      )';

    EXECUTE '
      CREATE POLICY "bookings_org_update" ON public.bookings
      FOR UPDATE USING (
        public.is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = bookings.organization_id
              AND om.user_id = auth.uid()
              AND om.seat_active = true
          )
        )
      ) WITH CHECK (
        public.is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = bookings.organization_id
              AND om.user_id = auth.uid()
              AND om.seat_active = true
          )
        )
      )';

    EXECUTE '
      CREATE POLICY "bookings_org_delete" ON public.bookings
      FOR DELETE USING (
        public.is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = bookings.organization_id
              AND om.user_id = auth.uid()
              AND om.seat_active = true
          )
        )
      )';

    RAISE NOTICE 'Created org-scoped RLS policies for bookings';
  ELSE
    RAISE NOTICE 'Table bookings does not exist (dropped) — skipping policies';
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Add indexes on organization_id for RLS performance
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF to_regclass('public.voice_agents') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'voice_agents'
        AND indexname = 'idx_voice_agents_organization_id'
    ) THEN
      CREATE INDEX idx_voice_agents_organization_id
        ON public.voice_agents (organization_id);
      RAISE NOTICE 'Created index idx_voice_agents_organization_id';
    END IF;
  END IF;
END$$;

DO $$ BEGIN
  IF to_regclass('public.call_logs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'call_logs'
        AND indexname = 'idx_call_logs_organization_id'
    ) THEN
      CREATE INDEX idx_call_logs_organization_id
        ON public.call_logs (organization_id);
      RAISE NOTICE 'Created index idx_call_logs_organization_id';
    END IF;
  END IF;
END$$;

DO $$ BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'bookings'
        AND indexname = 'idx_bookings_organization_id'
    ) THEN
      CREATE INDEX idx_bookings_organization_id
        ON public.bookings (organization_id);
      RAISE NOTICE 'Created index idx_bookings_organization_id';
    END IF;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Verification notice
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  va_policy_count int;
  cl_policy_count int;
BEGIN
  SELECT count(*) INTO va_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'voice_agents';

  SELECT count(*) INTO cl_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'call_logs';

  RAISE NOTICE '✅ voice_agents policies: %', va_policy_count;
  RAISE NOTICE '✅ call_logs policies: %', cl_policy_count;

  -- Fail-safe: ensure no tautology policies remain
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('voice_agents', 'call_logs', 'bookings')
      AND (qual = 'true' OR with_check = 'true')
  ) THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: tautology policy still exists on voice_agents/call_logs/bookings';
  END IF;
END$$;
