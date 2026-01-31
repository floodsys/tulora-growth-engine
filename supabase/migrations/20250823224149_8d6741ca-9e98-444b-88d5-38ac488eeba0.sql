-- Create enums
DO $$ BEGIN
    CREATE TYPE public.org_role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Disable RLS and drop all policies first
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update organization" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their own organizations" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "orgs owner delete" ON public.organizations;
DROP POLICY IF EXISTS "orgs owner update" ON public.organizations;
DROP POLICY IF EXISTS "orgs select by members" ON public.organizations;
DROP POLICY IF EXISTS "Admins can manage organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Members can view organization members" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members read self org" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Admins can view invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Users can view invitations by token" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_delete_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_insert_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_select_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_update_policy" ON public.organization_invitations;

-- Normalize organizations table structure
ALTER TABLE public.organizations 
DROP COLUMN IF EXISTS slug,
DROP COLUMN IF EXISTS settings,
DROP COLUMN IF EXISTS billing_tier,
DROP COLUMN IF EXISTS billing_status,
DROP COLUMN IF EXISTS stripe_customer_id,
DROP COLUMN IF EXISTS current_period_end,
DROP COLUMN IF EXISTS plan_key,
DROP COLUMN IF EXISTS is_demo,
DROP COLUMN IF EXISTS trial_ends_at,
DROP COLUMN IF EXISTS trial_started_at,
DROP COLUMN IF EXISTS entitlements,
DROP COLUMN IF EXISTS cancel_at_period_end,
DROP COLUMN IF EXISTS updated_at;

-- Make owner_user_id nullable as specified
ALTER TABLE public.organizations 
ALTER COLUMN owner_user_id DROP NOT NULL;

-- Fix organization_members structure
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_pkey CASCADE;

-- Add id column if doesn't exist
DO $$ BEGIN
    ALTER TABLE public.organization_members ADD COLUMN id uuid DEFAULT gen_random_uuid();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Set id as primary key
ALTER TABLE public.organization_members 
ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);

-- Add unique constraint on (organization_id, user_id)
DO $$
DECLARE
  has_org boolean;
  has_user boolean;
BEGIN
  IF to_regclass('public.organization_members') IS NULL THEN
    RAISE NOTICE 'public.organization_members missing; skipping org members unique constraint';
    RETURN;
  END IF;

  -- Normalize org column name (org_id -> organization_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_members' AND column_name='organization_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_members' AND column_name='org_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_members RENAME COLUMN org_id TO organization_id';
  END IF;

  -- (Optional) If your table used member_id instead of user_id in early migrations, normalize it:
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_members' AND column_name='user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_members' AND column_name='member_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_members RENAME COLUMN member_id TO user_id';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_members' AND column_name='organization_id'
  ) INTO has_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_members' AND column_name='user_id'
  ) INTO has_user;

  IF NOT (has_org AND has_user) THEN
    RAISE NOTICE 'Skipping org members unique constraint: organization_id=% user_id=%', has_org, has_user;
    RETURN;
  END IF;

  -- Idempotent drops (Postgres supports DROP CONSTRAINT IF EXISTS)
  EXECUTE 'ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_key';
  EXECUTE 'ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_unique';

  EXECUTE 'ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_organization_id_user_id_unique UNIQUE (organization_id, user_id)';
END $$;

-- Add temporary column for role conversion
ALTER TABLE public.organization_members 
ADD COLUMN role_new public.org_role;

-- Normalize and convert roles to enum
UPDATE public.organization_members 
SET role_new = CASE 
    WHEN lower(role::text) IN ('owner', 'admin') THEN 'admin'::public.org_role
    WHEN lower(role::text) = 'editor' THEN 'editor'::public.org_role
    WHEN lower(role::text) = 'viewer' THEN 'viewer'::public.org_role
    ELSE 'user'::public.org_role
END;

-- Replace the old role column
ALTER TABLE public.organization_members DROP COLUMN role;
ALTER TABLE public.organization_members ALTER COLUMN role_new SET NOT NULL;
ALTER TABLE public.organization_members RENAME COLUMN role_new TO role;

-- Set default for seat_active
ALTER TABLE public.organization_members 
ALTER COLUMN seat_active SET DEFAULT true;

-- Add foreign key constraint with cascade
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey,
ADD CONSTRAINT organization_members_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Fix organization_invitations structure
DO $$ BEGIN
    ALTER TABLE public.organization_invitations ADD COLUMN id uuid DEFAULT gen_random_uuid();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$
DECLARE
  tbl regclass := to_regclass('public.organization_invitations');
BEGIN
  IF tbl IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = tbl AND contype = 'p'
  ) THEN
    RAISE NOTICE 'organization_invitations already has a primary key; skipping';
  ELSE
    ALTER TABLE public.organization_invitations
      ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Add temporary columns for role and status conversion
ALTER TABLE public.organization_invitations 
ADD COLUMN role_new public.org_role;
ALTER TABLE public.organization_invitations 
ADD COLUMN status_new public.invitation_status;

-- Convert roles and status to enums
UPDATE public.organization_invitations 
SET role_new = CASE 
    WHEN lower(role::text) IN ('owner', 'admin') THEN 'admin'::public.org_role
    WHEN lower(role::text) = 'editor' THEN 'editor'::public.org_role
    WHEN lower(role::text) = 'viewer' THEN 'viewer'::public.org_role
    ELSE 'user'::public.org_role
END;

UPDATE public.organization_invitations 
SET status_new = CASE 
    WHEN lower(status::text) = 'pending' THEN 'pending'::public.invitation_status
    WHEN lower(status::text) = 'accepted' THEN 'accepted'::public.invitation_status
    WHEN lower(status::text) = 'revoked' THEN 'revoked'::public.invitation_status
    WHEN lower(status::text) = 'expired' THEN 'expired'::public.invitation_status
    ELSE 'pending'::public.invitation_status
END;

-- Replace the old columns
ALTER TABLE public.organization_invitations DROP COLUMN role;
ALTER TABLE public.organization_invitations DROP COLUMN status;
ALTER TABLE public.organization_invitations ALTER COLUMN role_new SET NOT NULL;
ALTER TABLE public.organization_invitations ALTER COLUMN status_new SET NOT NULL;
ALTER TABLE public.organization_invitations RENAME COLUMN role_new TO role;
ALTER TABLE public.organization_invitations RENAME COLUMN status_new TO status;

-- Set defaults
ALTER TABLE public.organization_invitations 
ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.organization_invitations 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Add unique constraint on invite_token (idempotent)
DO $$
BEGIN
  IF to_regclass('public.organization_invitations') IS NULL THEN
    RAISE NOTICE 'public.organization_invitations missing; skipping invite_token unique constraint';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_invitations' AND column_name='invite_token'
  ) THEN
    RAISE NOTICE 'invite_token column missing; skipping constraint';
    RETURN;
  END IF;

  -- Drop existing variants
  EXECUTE 'ALTER TABLE public.organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_invite_token_key';
  EXECUTE 'ALTER TABLE public.organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_invite_token_unique';

  EXECUTE 'ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_invite_token_unique UNIQUE (invite_token)';
END $$;

-- Add foreign key constraints
ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_fkey,
ADD CONSTRAINT organization_invitations_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_invited_by_fkey,
ADD CONSTRAINT organization_invitations_invited_by_fkey 
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Normalize legacy data in memberships table (guarded)
DO $$
BEGIN
  IF to_regclass('public.memberships') IS NULL THEN RETURN; END IF;
  EXECUTE 'UPDATE public.memberships SET role = ''admin'' WHERE role::text IN (''owner'',''Owner'',''OWNER'')';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not update memberships roles: %', SQLERRM;
END $$;
