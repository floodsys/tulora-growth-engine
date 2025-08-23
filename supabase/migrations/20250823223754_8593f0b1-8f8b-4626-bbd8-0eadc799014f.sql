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

-- Disable RLS completely to avoid policy conflicts
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies
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

-- Make owner_user_id nullable
ALTER TABLE public.organizations 
ALTER COLUMN owner_user_id DROP NOT NULL;

-- Normalize organization_members
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_pkey CASCADE;

-- Add id column if doesn't exist
DO $$ BEGIN
    ALTER TABLE public.organization_members ADD COLUMN id uuid DEFAULT gen_random_uuid();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Set primary key
ALTER TABLE public.organization_members 
ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);

-- Add unique constraint
DO $$ BEGIN
    ALTER TABLE public.organization_members 
    ADD CONSTRAINT organization_members_organization_id_user_id_unique UNIQUE (organization_id, user_id);
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- Normalize roles first
UPDATE public.organization_members 
SET role = 'admin' 
WHERE role IN ('owner', 'Owner', 'OWNER');

UPDATE public.organization_members 
SET role = lower(role);

-- Change role column type
ALTER TABLE public.organization_members 
ALTER COLUMN role DROP DEFAULT,
ALTER COLUMN role TYPE public.org_role USING role::public.org_role,
ALTER COLUMN seat_active SET DEFAULT true;

-- Add FK constraint
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey,
ADD CONSTRAINT organization_members_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Normalize organization_invitations
DO $$ BEGIN
    ALTER TABLE public.organization_invitations ADD COLUMN id uuid DEFAULT gen_random_uuid();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.organization_invitations 
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- Normalize invitation roles
UPDATE public.organization_invitations 
SET role = 'admin' 
WHERE role IN ('owner', 'Owner', 'OWNER');

UPDATE public.organization_invitations 
SET role = lower(role);

-- Change columns
ALTER TABLE public.organization_invitations 
ALTER COLUMN role TYPE public.org_role USING role::public.org_role,
ALTER COLUMN status TYPE public.invitation_status USING status::public.invitation_status,
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Add constraints
DO $$ BEGIN
    ALTER TABLE public.organization_invitations 
    ADD CONSTRAINT organization_invitations_invite_token_unique UNIQUE (invite_token);
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- Add FK constraints
ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_fkey,
ADD CONSTRAINT organization_invitations_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_invited_by_fkey,
ADD CONSTRAINT organization_invitations_invited_by_fkey 
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Normalize memberships table
UPDATE public.memberships 
SET role = 'admin' 
WHERE role IN ('owner', 'Owner', 'OWNER');