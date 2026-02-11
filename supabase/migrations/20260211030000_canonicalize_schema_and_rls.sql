-- =============================================================================
-- CANONICALIZATION MIGRATION: Re-assert final function bodies + RLS policies
-- =============================================================================
-- Purpose:
--   After 170+ historical migrations with many duplicated/evolved function
--   definitions, this single migration re-asserts the canonical (final)
--   versions of all high-value security functions and RLS policies.
--
--   This ensures that even if old migrations were noisy/duplicated, the DB
--   ends in a known-good state.
--
-- Properties:
--   - 100% idempotent (safe to run on fresh OR existing DBs)
--   - Uses CREATE OR REPLACE (no drops, no data loss)
--   - All SECURITY DEFINER functions include SET search_path
--   - All RLS policies use DROP IF EXISTS + CREATE (idempotent)
--   - Does NOT drop tables or require data loss
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. is_superadmin(uuid) — single source of truth for superadmin checks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  uid uuid;
BEGIN
  uid := COALESCE(user_id, auth.uid());
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.superadmins s
    WHERE s.user_id = uid
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. is_org_member(uuid) — check active org membership
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND seat_active = true
  );
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. is_org_admin(uuid) — check org ownership or admin role
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = org_id AND owner_user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = org_id
        AND user_id = auth.uid()
        AND role = 'admin'::org_role
        AND seat_active = true
    )
  );
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. check_admin_access(uuid, uuid) — admin check with superadmin bypass
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_admin_access(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org_id AND o.owner_user_id = COALESCE(p_user_id, auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = p_org_id
        AND om.user_id = COALESCE(p_user_id, auth.uid())
        AND om.role = 'admin'::org_role
        AND om.seat_active = true
    ) OR
    public.is_superadmin(COALESCE(p_user_id, auth.uid()));
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. get_user_org_role(uuid, uuid) — comprehensive role retrieval
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  result jsonb;
  is_owner boolean;
  member_role org_role;
  v_seat_active boolean;
BEGIN
  SELECT (owner_user_id = COALESCE(p_user_id, auth.uid())) INTO is_owner
  FROM public.organizations
  WHERE id = p_org_id;

  IF is_owner THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'is_owner', true,
      'seat_active', true,
      'is_member', true
    );
  END IF;

  SELECT role, seat_active INTO member_role, v_seat_active
  FROM public.organization_members
  WHERE organization_id = p_org_id
    AND user_id = COALESCE(p_user_id, auth.uid());

  IF member_role IS NOT NULL THEN
    RETURN jsonb_build_object(
      'role', member_role::text,
      'is_owner', false,
      'seat_active', COALESCE(v_seat_active, false),
      'is_member', true
    );
  END IF;

  RETURN jsonb_build_object(
    'role', null,
    'is_owner', false,
    'seat_active', false,
    'is_member', false
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. handle_new_user_signup() — canonical trigger function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
    new_org_id uuid;
    org_name text;
    org_industry text;
    org_size text;
BEGIN
    org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name',
                        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)) || '''s Organization');
    org_industry := NEW.raw_user_meta_data->>'industry';
    org_size := NEW.raw_user_meta_data->>'organization_size';

    INSERT INTO public.profiles (
        user_id, email, full_name, first_name, last_name,
        avatar_url, organization_name, organization_size, industry
    )
    VALUES (
        NEW.id, NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'avatar_url',
        org_name, org_size, org_industry
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        organization_name = COALESCE(EXCLUDED.organization_name, profiles.organization_name),
        organization_size = COALESCE(EXCLUDED.organization_size, profiles.organization_size),
        industry = COALESCE(EXCLUDED.industry, profiles.industry);

    IF NOT EXISTS (
        SELECT 1 FROM public.organizations
        WHERE owner_user_id = NEW.id
    ) THEN
        INSERT INTO public.organizations (name, owner_user_id, industry, size_band)
        VALUES (org_name, NEW.id, org_industry, org_size)
        RETURNING id INTO new_org_id;

        INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
        VALUES (new_org_id, NEW.id, 'admin'::public.org_role, true)
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        INSERT INTO public.agent_profiles (
            organization_id, name, system_prompt, voice, language,
            first_message_mode, first_message, retell_agent_id, status,
            is_default, warm_transfer_enabled, call_recording_enabled,
            max_tokens, temperature, settings
        ) VALUES (
            new_org_id, 'Sales Assistant',
            'You are a helpful sales assistant. Be friendly, professional, and focus on understanding the customer''s needs. Always ask clarifying questions and provide helpful information about our products and services.',
            'rebecca', 'en', 'assistant_speaks',
            'Hello! I''m your AI sales assistant. How can I help you today?',
            'temp_' || encode(extensions.gen_random_bytes(8), 'hex'),
            'active', true, false, true, 1000, 0.7,
            jsonb_build_object(
                'created_by_system', true,
                'sample_agent', true,
                'description', 'This is a sample agent to help you get started. You can edit or delete it anytime.'
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. trigger_external_integrations() — ensure search_path is set
-- ─────────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.trigger_external_integrations()
  SET search_path = 'pg_catalog', 'public';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Re-assert RLS policies for voice_agents (idempotent: drop + create)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF to_regclass('public.voice_agents') IS NOT NULL THEN
    ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
  END IF;
END$$;

-- Drop any existing policies on voice_agents (idempotent)
DROP POLICY IF EXISTS "admin_access_voice_agents"         ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_public_access"        ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_select_admin_only"    ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_insert_admin_only"    ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_update_admin_only"    ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_delete_admin_only"    ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_org_select"           ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_org_insert"           ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_org_update"           ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_org_delete"           ON public.voice_agents;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Re-assert RLS policies for call_logs (idempotent: drop + create)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF to_regclass('public.call_logs') IS NOT NULL THEN
    ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END$$;

DROP POLICY IF EXISTS "admin_access_call_logs"            ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_select_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_insert_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_update_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_delete_admin_only"       ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_select"              ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_insert"              ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_update"              ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_org_delete"              ON public.call_logs;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Verification block (informational — does NOT fail the migration)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fn_count int;
  va_pol int;
  cl_pol int;
BEGIN
  -- Count canonical functions
  SELECT count(*) INTO fn_count
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('is_superadmin','is_org_member','is_org_admin',
                      'check_admin_access','get_user_org_role','handle_new_user_signup');

  -- Count policies
  SELECT count(*) INTO va_pol FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'voice_agents';
  SELECT count(*) INTO cl_pol FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'call_logs';

  RAISE NOTICE '✅ Canonicalization complete:';
  RAISE NOTICE '   Security functions found: %/6', fn_count;
  RAISE NOTICE '   voice_agents policies: %', va_pol;
  RAISE NOTICE '   call_logs policies: %', cl_pol;

  -- Fail-safe: ensure no tautology policies remain
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('voice_agents', 'call_logs')
      AND (qual = 'true' OR with_check = 'true')
  ) THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: tautology policy still exists on voice_agents/call_logs';
  END IF;
END$$;
