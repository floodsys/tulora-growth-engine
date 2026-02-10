-- Harden SECURITY DEFINER functions that are missing a safe search_path.
--
-- Identified via MERGED_AUDIT_STATUS.md (Phase 4 hardening):
--   • public.trigger_external_integrations()  — created in migration 20250824012838
--     and never redefined with SET search_path.
--
-- ALTER FUNCTION … SET search_path is idempotent; re-running this migration
-- on a database where the setting already exists simply overwrites with the
-- same value.

ALTER FUNCTION public.trigger_external_integrations()
  SET search_path = 'pg_catalog', 'public';
