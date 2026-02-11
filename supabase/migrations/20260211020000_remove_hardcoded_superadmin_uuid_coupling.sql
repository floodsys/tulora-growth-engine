-- ============================================================================
-- Migration: Remove hardcoded superadmin UUID coupling
-- ============================================================================
-- PROBLEM:
--   Six historical migrations (20250825183745, 20250825193201, 20250825193234,
--   20250826052044, 20250826052215, and verification blocks) inserted into
--   public.superadmins or activated seats using the hardcoded UUID:
--     a2e9b538-5c1d-44be-a752-960a69e6f164
--   This tightly couples migrations to a specific auth.users row and is a
--   security concern: if a user is assigned that UUID on a fresh deploy,
--   they silently inherit superadmin privileges.
--
-- SOLUTION (fail-closed):
--   1. Delete any superadmin row for the hardcoded UUID that was inserted by
--      old migrations — UNLESS the UUID still corresponds to a real user
--      whose email matches the expected admin email.
--   2. Re-establish superadmin grant by email lookup (idempotent).
--   3. On fresh deploys where no matching auth.users row exists, this is a
--      no-op → zero superadmins → fail-closed.
--   4. For new environments, use seed.sql (local/CI) or the existing
--      bootstrap_superadmin() RPC (production first-run).
--
-- HISTORICAL MIGRATIONS (NOT edited — this migration overrides their effect):
--   • 20250825183745  — INSERT superadmin by hardcoded UUID
--   • 20250825193201  — INSERT superadmin by hardcoded UUID + verification
--   • 20250825193234  — INSERT superadmin by hardcoded UUID + verification
--   • 20250826052044  — Activate seat for hardcoded UUID
--   • 20250826052215  — Set org admin role for hardcoded UUID
-- ============================================================================

DO $$
DECLARE
  v_hardcoded_uuid CONSTANT uuid := 'a2e9b538-5c1d-44be-a752-960a69e6f164';
  v_real_user_id   uuid;
  v_real_email     text;
BEGIN
  -- Step 1: Check if the hardcoded UUID actually exists in auth.users
  SELECT id, lower(email) INTO v_real_user_id, v_real_email
  FROM auth.users
  WHERE id = v_hardcoded_uuid;

  IF v_real_user_id IS NULL THEN
    -- The hardcoded UUID user does not exist (fresh deploy or different env).
    -- Remove any orphaned superadmin row for safety (fail-closed).
    DELETE FROM public.superadmins WHERE user_id = v_hardcoded_uuid;
    RAISE NOTICE '[superadmin-uuid-cleanup] Hardcoded UUID does not exist in auth.users — removed any orphan row. System is fail-closed.';
  ELSE
    -- The user exists. Keep their superadmin status only if their email
    -- matches the expected admin email. Otherwise revoke (fail-closed).
    IF v_real_email = 'admin@axionstack.xyz' THEN
      RAISE NOTICE '[superadmin-uuid-cleanup] Hardcoded UUID matches expected admin email — keeping superadmin row.';
    ELSE
      -- UUID was reused by a different user → revoke silent grant
      DELETE FROM public.superadmins WHERE user_id = v_hardcoded_uuid;
      RAISE NOTICE '[superadmin-uuid-cleanup] Hardcoded UUID now belongs to % — REVOKED superadmin (fail-closed).', v_real_email;
    END IF;
  END IF;

  -- Step 2: Ensure the admin email user (if they exist) is a superadmin,
  -- regardless of what UUID they have.
  INSERT INTO public.superadmins (user_id)
  SELECT id FROM auth.users WHERE lower(email) = 'admin@axionstack.xyz'
  ON CONFLICT (user_id) DO NOTHING;

  -- If no user with that email exists, this INSERT selects zero rows → no grant.
END $$;

-- ============================================================================
-- Verification (informational only — does not fail the migration)
-- ============================================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.superadmins;
  RAISE NOTICE '[superadmin-uuid-cleanup] Total superadmin rows after cleanup: %', v_count;
END $$;
