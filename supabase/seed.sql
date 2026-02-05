-- ============================================================================
-- Supabase Seed Data
-- ============================================================================
-- This file contains idempotent seed data for local development and testing.
-- It is run automatically by `supabase db reset` and can be run manually.
-- All inserts use ON CONFLICT to make them replay-safe.
--
-- NOTE: This file should be tracked in git for deterministic dev/CI seeds.
--       Add to .gitignore only if you need local-only seed customizations.
-- ============================================================================

-- Enable pgcrypto for password hashing if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- (A) Create test user in auth.users
-- ============================================================================
-- This user is referenced by organization_members.user_id which has FK to auth.users(id)
-- The handle_new_user_signup trigger will automatically:
--   1. Create a profile in public.profiles
--   2. Create an organization in public.organizations
--   3. Create an organization_members entry
--   4. Seed a sample agent_profile
--
-- Since the trigger handles profile/org creation, we only need to insert the
-- auth.users row here. However, we may want to control the exact org/profile
-- data for testing, so we do it manually after the trigger runs.

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    last_sign_in_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES (
    'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',                          -- id (test user UUID)
    '00000000-0000-0000-0000-000000000000',                          -- instance_id
    'authenticated',                                                  -- aud
    'authenticated',                                                  -- role
    'test-owner@example.com',                                         -- email
    crypt('password123', gen_salt('bf')),                            -- encrypted_password
    now(),                                                            -- email_confirmed_at
    '{"provider":"email","providers":["email"]}'::jsonb,             -- raw_app_meta_data
    '{"full_name":"Test Owner","organization_name":"Test Organization"}'::jsonb, -- raw_user_meta_data
    now(),                                                            -- created_at
    now(),                                                            -- updated_at
    now(),                                                            -- last_sign_in_at
    '',                                                               -- confirmation_token (empty string)
    '',                                                               -- email_change (empty string)
    '',                                                               -- email_change_token_new (empty string)
    ''                                                                -- recovery_token (empty string)
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

-- ============================================================================
-- (B) Create auth.identities entry for the test user
-- ============================================================================
-- Required for email provider authentication to work properly

INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
VALUES (
    'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',                          -- id (same as user_id for email provider)
    'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',                          -- user_id
    'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',                          -- provider_id (same as user_id for email)
    jsonb_build_object(
        'sub', 'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',
        'email', 'test-owner@example.com',
        'email_verified', true,
        'provider', 'email'
    ),                                                                -- identity_data
    'email',                                                          -- provider
    now(),                                                            -- last_sign_in_at
    now(),                                                            -- created_at
    now()                                                             -- updated_at
)
ON CONFLICT (provider_id, provider) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

-- ============================================================================
-- (C) Update profile with specific test data (trigger already created it)
-- ============================================================================
-- The trigger handle_new_user_signup creates the profile automatically.
-- Here we just ensure the full_name is set for testing purposes.

UPDATE public.profiles
SET full_name = 'Test Owner'
WHERE user_id = 'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b';

-- ============================================================================
-- (D) Get the organization created by the trigger and update it if needed
-- ============================================================================
-- The trigger creates an organization with owner_user_id = NEW.id
-- We can update its details here for deterministic test data.

UPDATE public.organizations
SET name = 'Test Organization'
WHERE owner_user_id = 'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b';

-- ============================================================================
-- (E) Create deterministic CI test organization with known UUID
-- ============================================================================
-- For CI testing, we need a deterministic organization ID that can be
-- hardcoded in GitHub Actions workflows without secrets.
-- This UUID is used as VITE_TEST_ORG_ID in CI environments.

-- First, create a dedicated CI test user if not exists
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    last_sign_in_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES (
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',                          -- id (CI test user UUID)
    '00000000-0000-0000-0000-000000000000',                          -- instance_id
    'authenticated',                                                  -- aud
    'authenticated',                                                  -- role
    'ci-test-user@example.com',                                       -- email
    crypt('ci-test-password-123', gen_salt('bf')),                   -- encrypted_password
    now(),                                                            -- email_confirmed_at
    '{"provider":"email","providers":["email"]}'::jsonb,             -- raw_app_meta_data
    '{"full_name":"CI Test User","organization_name":"CI Test Organization"}'::jsonb,
    now(),                                                            -- created_at
    now(),                                                            -- updated_at
    now(),                                                            -- last_sign_in_at
    '',                                                               -- confirmation_token
    '',                                                               -- email_change
    '',                                                               -- email_change_token_new
    ''                                                                -- recovery_token
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

-- Create identity for CI test user
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
VALUES (
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    jsonb_build_object(
        'sub', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        'email', 'ci-test-user@example.com',
        'email_verified', true,
        'provider', 'email'
    ),
    'email',
    now(),
    now(),
    now()
)
ON CONFLICT (provider_id, provider) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

-- Create profile for CI test user (in case trigger doesn't fire on conflict)
INSERT INTO public.profiles (user_id, full_name)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'CI Test User')
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Create the deterministic CI test organization
-- UUID: 11111111-1111-1111-1111-111111111111
-- This is the value to use for VITE_TEST_ORG_ID in CI
INSERT INTO public.organizations (
    id,
    name,
    owner_user_id,
    created_at,
    updated_at
)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'CI Test Organization',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = now();

-- Add CI test user as owner member of the CI test organization
INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    joined_at
)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'owner',
    now()
)
ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role;

-- ============================================================================
-- End of seed data
-- ============================================================================
-- 
-- VERIFICATION: After running `supabase db reset`, you should have:
--   1. A test user in auth.users (test-owner@example.com / password123)
--   2. A profile in public.profiles (auto-created by trigger)
--   3. An organization in public.organizations (auto-created by trigger)
--   4. An organization_members row (auto-created by trigger)
--   5. A sample agent_profile (auto-created by trigger)
--   6. A CI test organization with UUID 11111111-1111-1111-1111-111111111111
--      (use this for VITE_TEST_ORG_ID in CI environments)
--
-- To log in: Use email "test-owner@example.com" with password "password123"
-- CI Test Org ID: 11111111-1111-1111-1111-111111111111
-- ============================================================================
