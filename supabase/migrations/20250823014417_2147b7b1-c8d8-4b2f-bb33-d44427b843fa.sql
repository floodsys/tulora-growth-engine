-- =============================================================================
-- Ensure the test user + test organization exist BEFORE any child-table inserts
-- so the FK constraints (organization_members → organizations, auth.users) are
-- satisfied even on a cold `supabase db reset`.
-- Every statement is idempotent (ON CONFLICT … DO NOTHING).
-- =============================================================================

-- (1) Parent: auth.users — test-owner account
--     The on_auth_user_created trigger (from 20250818025332) calls
--     handle_new_user() which INSERTs into public.profiles — a table that
--     does not exist yet at this point in the migration sequence.
--     We temporarily replace the function with a no-op, insert the user,
--     then restore the original function body.

-- 1a. Replace handle_new_user with a no-op
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 1b. Insert the test user
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
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES (
    'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'test-owner@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Test Owner","organization_name":"Test Organization"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
)
ON CONFLICT (id) DO NOTHING;

-- 1c. Restore the real handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (2) Parent: public.organizations — test organization
--     slug has a UNIQUE NOT NULL constraint, so we guard on both id and slug.
INSERT INTO public.organizations (id, name, slug)
SELECT
    '8ed6b425-57ad-4b5c-9618-747264d6c4f9',
    'Test Organization',
    'test-organization'
WHERE NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = '8ed6b425-57ad-4b5c-9618-747264d6c4f9'
)
AND NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE slug = 'test-organization'
);

-- (3) Child: organization_members — add user as owner
INSERT INTO public.organization_members (org_id, user_id, role, seat_active)
VALUES (
    '8ed6b425-57ad-4b5c-9618-747264d6c4f9',
    'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',
    'owner',
    true
)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- (4) Child: memberships — add a membership record for consistency
INSERT INTO public.memberships (organization_id, user_id, role, status)
VALUES (
    '8ed6b425-57ad-4b5c-9618-747264d6c4f9',
    'ce9a73ad-2615-4317-984c-ddc7ddf9dc2b',
    'owner',
    'active'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;
