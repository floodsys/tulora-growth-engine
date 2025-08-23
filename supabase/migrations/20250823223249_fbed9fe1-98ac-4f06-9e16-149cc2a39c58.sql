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

-- Drop existing policies that depend on role columns
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON public.organization_members;

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

-- Fix organization_members structure
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_pkey CASCADE,
DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_key CASCADE;

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
ALTER TABLE public.organization_members 
ADD CONSTRAINT organization_members_organization_id_user_id_unique UNIQUE (organization_id, user_id);

-- Normalize legacy roles first
UPDATE public.organization_members 
SET role = 'admin' 
WHERE role = 'owner' OR role = 'Owner' OR role = 'OWNER';

-- Ensure all roles are lowercase
UPDATE public.organization_members 
SET role = lower(role);

-- Drop default and change role column to use enum
ALTER TABLE public.organization_members ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.organization_members 
ALTER COLUMN role TYPE public.org_role USING role::public.org_role;

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

-- Set id as primary key if not already
DO $$ BEGIN
    ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN others THEN null;
END $$;

-- Normalize legacy roles in invitations
UPDATE public.organization_invitations 
SET role = 'admin' 
WHERE role = 'owner' OR role = 'Owner' OR role = 'OWNER';

-- Ensure all roles are lowercase
UPDATE public.organization_invitations 
SET role = lower(role);

-- Change role column to use enum
ALTER TABLE public.organization_invitations 
ALTER COLUMN role TYPE public.org_role USING role::public.org_role;

-- Change status column to use enum
ALTER TABLE public.organization_invitations 
ALTER COLUMN status TYPE public.invitation_status USING status::public.invitation_status;

-- Set defaults
ALTER TABLE public.organization_invitations 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Add unique constraint on invite_token
DO $$ BEGIN
    ALTER TABLE public.organization_invitations 
    ADD CONSTRAINT organization_invitations_invite_token_unique UNIQUE (invite_token);
EXCEPTION
    WHEN duplicate_table THEN null;
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

-- Normalize legacy data in memberships table
UPDATE public.memberships 
SET role = 'admin' 
WHERE role = 'owner' OR role = 'Owner' OR role = 'OWNER';

-- Recreate policies with corrected logic
CREATE POLICY "organizations_update_policy" ON public.organizations
FOR UPDATE USING (
    (owner_user_id = auth.uid()) OR 
    (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = organizations.id 
        AND user_id = auth.uid() 
        AND role = 'admin'::public.org_role 
        AND seat_active = true
    ))
);

CREATE POLICY "organization_members_select_policy" ON public.organization_members
FOR SELECT USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    )) OR 
    (EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_members.organization_id 
        AND om.user_id = auth.uid() 
        AND om.seat_active = true
    ))
);

CREATE POLICY "organization_members_insert_policy" ON public.organization_members
FOR INSERT WITH CHECK (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    )) OR 
    (EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_members.organization_id 
        AND om.user_id = auth.uid() 
        AND om.role = 'admin'::public.org_role 
        AND om.seat_active = true
    ))
);

CREATE POLICY "organization_members_update_policy" ON public.organization_members
FOR UPDATE USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    )) OR 
    (EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_members.organization_id 
        AND om.user_id = auth.uid() 
        AND om.role = 'admin'::public.org_role 
        AND om.seat_active = true
    ))
);

CREATE POLICY "organization_members_delete_policy" ON public.organization_members
FOR DELETE USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    )) OR 
    (EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_members.organization_id 
        AND om.user_id = auth.uid() 
        AND om.role = 'admin'::public.org_role 
        AND om.seat_active = true
    ))
);