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

-- Normalize organizations table structure
-- Remove unnecessary columns and keep core fields
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

-- Ensure organization_members has correct structure
-- Drop and recreate with proper constraints
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
WHERE role = 'owner' OR role = 'Owner';

-- Ensure all roles are lowercase
UPDATE public.organization_members 
SET role = lower(role);

-- Drop default before changing type, then change role column to use enum
ALTER TABLE public.organization_members ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.organization_members 
ALTER COLUMN role TYPE public.org_role USING role::public.org_role;

-- Set default for seat_active
ALTER TABLE public.organization_members 
ALTER COLUMN seat_active SET DEFAULT true;

-- Add foreign key constraints with proper cascade
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey,
ADD CONSTRAINT organization_members_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Ensure organization_invitations has correct structure
-- Add id column if it doesn't exist
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
WHERE role = 'owner' OR role = 'Owner';

-- Ensure all roles are lowercase
UPDATE public.organization_invitations 
SET role = lower(role);

-- Change role column to use enum
ALTER TABLE public.organization_invitations 
ALTER COLUMN role TYPE public.org_role USING role::public.org_role;

-- Change status column to use enum
ALTER TABLE public.organization_invitations 
ALTER COLUMN status TYPE public.invitation_status USING status::public.invitation_status;

-- Set default status
ALTER TABLE public.organization_invitations 
ALTER COLUMN status SET DEFAULT 'pending';

-- Set default expires_at
ALTER TABLE public.organization_invitations 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

-- Add unique constraint on invite_token
ALTER TABLE public.organization_invitations 
ADD CONSTRAINT organization_invitations_invite_token_unique UNIQUE (invite_token);

-- Add foreign key constraints with proper cascade and set null
ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_organization_id_fkey,
ADD CONSTRAINT organization_invitations_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_invited_by_fkey,
ADD CONSTRAINT organization_invitations_invited_by_fkey 
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Normalize any legacy data in memberships table
UPDATE public.memberships 
SET role = 'admin' 
WHERE role = 'owner' OR role = 'Owner';