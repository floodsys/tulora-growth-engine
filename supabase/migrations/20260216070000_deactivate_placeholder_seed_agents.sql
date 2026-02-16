-- ============================================================================
-- Migration: Deactivate placeholder/seed Retell agent entries
-- ============================================================================
-- Prevents regression where seed data with fake agent_ids (e.g.
-- agent_12345abcde, agent_67890fghij, agent_klmno12345, temp_*) could
-- appear as "active" in the system and break strict verification.
--
-- This migration is IDEMPOTENT — safe to run on any environment.
-- It does NOT delete data, only sets status to 'disabled' / is_active=false.
-- ============================================================================

-- (A) Deactivate known placeholder agent_profiles rows
-- These were inserted by early seed migrations (20250818041513, 20250818041742)
-- with status='active' and fake retell_agent_ids.
UPDATE public.agent_profiles
SET status = 'disabled'
WHERE retell_agent_id IN (
  'agent_12345abcde',
  'agent_67890fghij',
  'agent_klmno12345'
)
AND status != 'disabled';

-- (B) Deactivate agent_profiles with temp_ prefix retell_agent_ids
-- These are created by the AgentCatalog before real Retell provisioning.
UPDATE public.agent_profiles
SET status = 'disabled'
WHERE retell_agent_id LIKE 'temp_%'
AND status = 'active';

-- (C) Deactivate retell_agents rows with placeholder agent_id patterns
-- Covers: temp_*, agent_12345abcde, agent_67890fghij, agent_klmno12345,
--         placeholder_*, test_*, demo_*, fake_*
UPDATE public.retell_agents
SET is_active = false
WHERE is_active = true
AND (
  agent_id LIKE 'temp_%'
  OR agent_id LIKE 'placeholder_%'
  OR agent_id LIKE 'test_%'
  OR agent_id LIKE 'demo_%'
  OR agent_id LIKE 'fake_%'
  OR agent_id IN (
    'agent_12345abcde',
    'agent_67890fghij',
    'agent_klmno12345'
  )
);

-- (D) Add a CHECK constraint to prevent future placeholder agent_ids from
--     being set to active. This is a safety net; the application layer
--     should also prevent this.
-- NOTE: We use DO $$ ... $$ to make this idempotent (skip if exists).
DO $$
BEGIN
  -- agent_profiles: placeholder retell_agent_ids cannot be 'active'
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_agent_profiles_no_placeholder_active'
  ) THEN
    ALTER TABLE public.agent_profiles
    ADD CONSTRAINT chk_agent_profiles_no_placeholder_active
    CHECK (
      status != 'active'
      OR (
        retell_agent_id IS NULL
        OR (
          retell_agent_id NOT LIKE 'temp_%'
          AND retell_agent_id NOT LIKE 'placeholder_%'
          AND retell_agent_id NOT LIKE 'test_%'
          AND retell_agent_id NOT LIKE 'demo_%'
          AND retell_agent_id NOT LIKE 'fake_%'
          AND retell_agent_id NOT IN (
            'agent_12345abcde',
            'agent_67890fghij',
            'agent_klmno12345'
          )
        )
      )
    );
  END IF;
END $$;
