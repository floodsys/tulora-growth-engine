-- ============================================================================
-- Edge Function + RLS Integration Test Data Seed
-- ============================================================================
-- This script seeds the local Supabase database with test data required
-- for the edge-function-rls.spec.ts integration tests.
--
-- Prerequisites:
--   - supabase start (local Supabase running)
--   - All migrations applied
--
-- Run with:
--   psql postgresql://postgres:postgres@localhost:54322/postgres -f scripts/seed-edge-rls-test-data.sql
--
-- Or via Supabase CLI:
--   supabase db reset && psql postgresql://postgres:postgres@localhost:54322/postgres -f scripts/seed-edge-rls-test-data.sql
-- ============================================================================

-- Start transaction for atomic seeding
BEGIN;

-- ============================================================================
-- Clean up existing test data (if any)
-- ============================================================================
DELETE FROM crm_outbox WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
DELETE FROM leads WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
DELETE FROM calls WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
DELETE FROM retell_agents WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
DELETE FROM organization_members WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
DELETE FROM organizations WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

-- ============================================================================
-- Create test users in auth.users (if they don't exist)
-- ============================================================================
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
) VALUES
(
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000000',
  'test-user-a@test.local',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Test User A"}',
  'authenticated',
  'authenticated'
),
(
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000000',
  'test-user-b@test.local',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Test User B"}',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('TestPassword123!', gen_salt('bf')),
  updated_at = NOW();

-- Also add to auth.identities for proper auth flow
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000101',
  '{"sub": "00000000-0000-0000-0000-000000000101", "email": "test-user-a@test.local"}',
  'email',
  'test-user-a@test.local',
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000102',
  '{"sub": "00000000-0000-0000-0000-000000000102", "email": "test-user-b@test.local"}',
  'email',
  'test-user-b@test.local',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Create test organizations
-- ============================================================================
INSERT INTO organizations (
  id,
  name,
  status,
  billing_status,
  created_at,
  updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Test Organization A',
  'active',
  'active',
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000002',
  'Test Organization B',
  'active',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================================================
-- Create organization memberships
-- User A belongs to Org A only
-- User B belongs to Org B only
-- ============================================================================
INSERT INTO organization_members (
  id,
  organization_id,
  user_id,
  role,
  seat_active,
  created_at,
  updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000001', -- Org A
  '00000000-0000-0000-0000-000000000101', -- User A
  'admin',
  true,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000002', -- Org B
  '00000000-0000-0000-0000-000000000102', -- User B
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  seat_active = true,
  updated_at = NOW();

-- ============================================================================
-- Create test agents with different statuses
-- ============================================================================
INSERT INTO retell_agents (
  id,
  organization_id,
  agent_id,
  name,
  status,
  is_active,
  created_at,
  updated_at
) VALUES
-- Org A agents
(
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000001', -- Org A
  'agent_active_test_001',
  'Active Test Agent',
  'ACTIVE',
  true,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000001', -- Org A
  'agent_draft_test_001',
  'Draft Test Agent',
  'DRAFT',
  true,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000001', -- Org A
  'agent_testing_test_001',
  'Testing Test Agent',
  'TESTING',
  true,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000304',
  '00000000-0000-0000-0000-000000000001', -- Org A
  'agent_paused_test_001',
  'Paused Test Agent',
  'PAUSED',
  true,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000305',
  '00000000-0000-0000-0000-000000000001', -- Org A
  'agent_archived_test_001',
  'Archived Test Agent',
  'ARCHIVED',
  false, -- is_active = false for archived
  NOW(),
  NOW()
),
-- Org B agent
(
  '00000000-0000-0000-0000-000000000306',
  '00000000-0000-0000-0000-000000000002', -- Org B
  'agent_org_b_test_001',
  'Org B Test Agent',
  'ACTIVE',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- Create test leads
-- ============================================================================
INSERT INTO leads (
  id,
  organization_id,
  full_name,
  name,
  email,
  phone,
  company,
  message,
  inquiry_type,
  crm_sync_status,
  created_at,
  updated_at
) VALUES
-- Org A lead
(
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001', -- Org A
  'Lead User A',
  'Lead User A',
  'lead-a@test.local',
  '+15551111111',
  'Test Company A',
  'Test inquiry from Org A',
  'contact',
  'pending',
  NOW(),
  NOW()
),
-- Org B lead
(
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000002', -- Org B
  'Lead User B',
  'Lead User B',
  'lead-b@test.local',
  '+15552222222',
  'Test Company B',
  'Test inquiry from Org B',
  'contact',
  'pending',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  updated_at = NOW();

-- ============================================================================
-- Create CRM outbox entries for testing
-- ============================================================================
INSERT INTO crm_outbox (
  id,
  organization_id,
  lead_id,
  status,
  attempt_count,
  created_at,
  updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000001', -- Org A
  '00000000-0000-0000-0000-000000000011', -- Lead A
  'pending',
  0,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000002', -- Org B
  '00000000-0000-0000-0000-000000000012', -- Lead B
  'pending',
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================================================
-- Create billing/quota entries (optional - for quota tests)
-- ============================================================================
-- Note: Uncomment and adjust if your schema has billing_usage or similar tables
-- INSERT INTO billing_usage (
--   organization_id,
--   metric,
--   current_usage,
--   limit_value,
--   period_start,
--   period_end
-- ) VALUES
-- (
--   '00000000-0000-0000-0000-000000000001',
--   'calls',
--   50,
--   100,
--   DATE_TRUNC('month', NOW()),
--   DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
-- )
-- ON CONFLICT DO NOTHING;

-- Commit transaction
COMMIT;

-- ============================================================================
-- Verify seeded data
-- ============================================================================
SELECT 'Organizations' as entity, count(*) as count FROM organizations WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
UNION ALL
SELECT 'Organization Members', count(*) FROM organization_members WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
UNION ALL
SELECT 'Retell Agents', count(*) FROM retell_agents WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
UNION ALL
SELECT 'Leads', count(*) FROM leads WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
UNION ALL
SELECT 'CRM Outbox', count(*) FROM crm_outbox WHERE organization_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

\echo 'Test data seeding complete!'
\echo 'Test User A: test-user-a@test.local / TestPassword123!'
\echo 'Test User B: test-user-b@test.local / TestPassword123!'
