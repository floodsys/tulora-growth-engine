-- Create role enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.org_role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create status enum for invitations
DO $$ BEGIN
    CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Disable RLS temporarily to avoid policy conflicts
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations DISABLE ROW LEVEL SECURITY;

-- Normalize organizations table structure - keep essential fields only
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

-- Make owner_user_id nullable
ALTER TABLE public.organizations 
ALTER COLUMN owner_user_id DROP NOT NULL;

-- Fix organization_members structure
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_pkey CASCADE;

-- Add id column if it doesn't exist
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

-- Normalize legacy roles first (guarded)
DO $$
DECLARE t regtype;
BEGIN
  IF to_regclass('public.organization_members') IS NULL THEN RETURN; END IF;

  SELECT a.atttypid::regtype INTO t
  FROM pg_attribute a
  WHERE a.attrelid = 'public.organization_members'::regclass
    AND a.attname  = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  -- Only normalize when role is text-like (skip enum org_role/public.org_role)
  IF t IS NOT NULL AND t::text IN ('text','character varying','character') THEN
    UPDATE public.organization_members SET role = lower(role);
  END IF;
END $$;

-- Change role column to use enum (NO-ALTER guard)
DO $$
DECLARE t regtype;
BEGIN
  IF to_regclass('public.organization_members') IS NULL THEN RETURN; END IF;

  SELECT a.atttypid::regtype INTO t
  FROM pg_attribute a
  WHERE a.attrelid='public.organization_members'::regclass
    AND a.attname='role'
    AND a.attnum>0
    AND NOT a.attisdropped;

  IF t IS NULL THEN RETURN; END IF;
  IF t::text IN ('org_role','public.org_role') THEN RETURN; END IF;

  RAISE NOTICE 'Skipping organization_members.role conversion here; handled earlier in 20250823211335.';
END $$;

-- Set default for seat_active
ALTER TABLE public.organization_members 
ALTER COLUMN seat_active SET DEFAULT true;

-- Add foreign key constraints
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

-- Set id as primary key if not already (idempotent guard prevents 42P16)
DO $$
BEGIN
  IF to_regclass('public.organization_invitations') IS NULL THEN RETURN; END IF;

  -- If a primary key already exists, do nothing (prevents 42P16)
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.organization_invitations'::regclass
      AND contype = 'p'
  ) THEN
    RETURN;
  END IF;

  -- Only add PK if id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization_invitations' AND column_name='id'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id)';
END $$;

-- Normalize legacy roles in invitations (guarded - only run if role is text-like)
DO $$
DECLARE t regtype;
BEGIN
  IF to_regclass('public.organization_invitations') IS NULL THEN RETURN; END IF;

  SELECT a.atttypid::regtype INTO t
  FROM pg_attribute a
  WHERE a.attrelid = 'public.organization_invitations'::regclass
    AND a.attname  = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF t IS NOT NULL AND t::text IN ('text','character varying','character') THEN
    UPDATE public.organization_invitations SET role = lower(role);
  END IF;
END $$;

-- Change role column to use enum (NO-ALTER guard)
DO $$
DECLARE t regtype;
BEGIN
  IF to_regclass('public.organization_invitations') IS NULL THEN RETURN; END IF;

  SELECT a.atttypid::regtype INTO t
  FROM pg_attribute a
  WHERE a.attrelid='public.organization_invitations'::regclass
    AND a.attname='role'
    AND a.attnum>0
    AND NOT a.attisdropped;

  IF t IS NULL THEN RETURN; END IF;
  IF t::text IN ('org_role','public.org_role') THEN RETURN; END IF;

  RAISE NOTICE 'Skipping organization_invitations.role conversion here; handled earlier in 20250823211335.';
END $$;

-- Change status column to use enum (guarded: DROP DEFAULT -> ALTER TYPE -> SET DEFAULT)
DO $$
DECLARE
  t regtype;
  r record;
BEGIN
  IF to_regclass('public.organization_invitations') IS NULL THEN RETURN; END IF;

  SELECT a.atttypid::regtype INTO t
  FROM pg_attribute a
  WHERE a.attrelid = 'public.organization_invitations'::regclass
    AND a.attname  = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF t IS NULL THEN RETURN; END IF;
  IF t::text IN ('invitation_status','public.invitation_status') THEN RETURN; END IF;

  -- Drop CHECK constraints that use status with ::text (these break after the column becomes enum)
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.organization_invitations'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      AND pg_get_constraintdef(c.oid) ILIKE '%::text%'
  LOOP
    EXECUTE format('ALTER TABLE public.organization_invitations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  -- Drop default before changing type (required by Postgres)
  EXECUTE 'ALTER TABLE public.organization_invitations ALTER COLUMN status DROP DEFAULT';
  -- Change type with USING cast
  EXECUTE 'ALTER TABLE public.organization_invitations ALTER COLUMN status TYPE public.invitation_status USING status::public.invitation_status';
  -- Restore default
  EXECUTE 'ALTER TABLE public.organization_invitations ALTER COLUMN status SET DEFAULT ''pending''::public.invitation_status';
END $$;

-- Set defaults
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

-- Re-enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
