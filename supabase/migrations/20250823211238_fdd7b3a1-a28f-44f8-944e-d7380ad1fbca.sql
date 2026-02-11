-- Create role enum if not exists
DO $$ BEGIN
    CREATE TYPE public.org_role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create organizations table if not exists
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Add missing columns to organizations if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'owner_user_id') THEN
        ALTER TABLE public.organizations ADD COLUMN owner_user_id uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- Add columns to organization_members if missing (table created earlier with org_id)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_members' AND column_name = 'id') THEN
        ALTER TABLE public.organization_members ADD COLUMN id uuid DEFAULT gen_random_uuid();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_members' AND column_name = 'created_at') THEN
        ALTER TABLE public.organization_members ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;
END $$;

-- Create organization_invitations table if not exists
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    role public.org_role NOT NULL DEFAULT 'viewer',
    invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    invite_token text UNIQUE NOT NULL,
    expires_at timestamptz DEFAULT (now() + interval '7 days'),
    created_at timestamptz DEFAULT now()
);

-- Normalize any existing 'owner' roles to 'admin' in organization_members
UPDATE public.organization_members 
SET role = 'admin'::public.org_role 
WHERE role::text = 'owner';

-- Normalize any existing 'owner' roles to 'admin' in organization_invitations
UPDATE public.organization_invitations 
SET role = 'admin'::public.org_role 
WHERE role::text = 'owner';

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Create helper functions for RLS policies (drop with cascade to remove dependent policies)
-- Removed: DROP FUNCTION IF EXISTS public.is_org_admin(uuid) CASCADE;
-- (CREATE OR REPLACE handles redefinition safely without breaking dependent policies)
CREATE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = $1
      AND m.user_id = auth.uid()
      AND m.role::text = 'admin'
      AND m.seat_active = true
  ) OR EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = $1
      AND owner_user_id = auth.uid()
  );
$$;

-- Removed: DROP FUNCTION IF EXISTS public.is_org_member(uuid) CASCADE;
-- (CREATE OR REPLACE handles redefinition safely without breaking dependent policies)
CREATE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = $1
      AND m.user_id = auth.uid()
      AND m.seat_active = true
  ) OR EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = $1
      AND owner_user_id = auth.uid()
  );
$$;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can view invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Users can view invitations by token" ON public.organization_invitations;

-- Create RLS policies for organizations
CREATE POLICY "Users can view their organizations" ON public.organizations
    FOR SELECT USING (is_org_member(id));

CREATE POLICY "Org admins can update organizations" ON public.organizations
    FOR UPDATE USING (is_org_admin(id));

CREATE POLICY "Users can create organizations" ON public.organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create RLS policies for organization_members
CREATE POLICY "Members can view organization members" ON public.organization_members
    FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Admins can manage organization members" ON public.organization_members
    FOR ALL USING (is_org_admin(org_id));

-- Create RLS policies for organization_invitations
CREATE POLICY "Admins can view invitations" ON public.organization_invitations
    FOR SELECT USING (is_org_admin(organization_id));

CREATE POLICY "Admins can manage invitations" ON public.organization_invitations
    FOR ALL USING (is_org_admin(organization_id));

CREATE POLICY "Users can view invitations by token" ON public.organization_invitations
    FOR SELECT USING (true);

-- Create RPC functions for invitation management
CREATE OR REPLACE FUNCTION public.create_invite(
    org_id uuid,
    invite_email text,
    invite_role public.org_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    token text;
    invitation_id uuid;
BEGIN
    -- Check if user is admin of the organization
    IF NOT is_org_admin(org_id) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Generate unique token
    token := encode(gen_random_bytes(32), 'base64url');
    
    -- Insert invitation
    INSERT INTO public.organization_invitations (
        organization_id,
        email,
        role,
        invited_by,
        invite_token
    ) VALUES (
        org_id,
        invite_email,
        invite_role,
        auth.uid(),
        token
    ) RETURNING id INTO invitation_id;
    
    RETURN invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    invitation record;
    existing_member record;
BEGIN
    -- Get invitation details
    SELECT * INTO invitation
    FROM public.organization_invitations
    WHERE invite_token = p_token
      AND status = 'pending'
      AND expires_at > now();
    
    IF invitation IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
    END IF;
    
    -- Check if user is already a member
    SELECT * INTO existing_member
    FROM public.organization_members
    WHERE org_id = invitation.organization_id
      AND user_id = auth.uid();
    
    IF existing_member IS NOT NULL THEN
        -- Update existing membership
        UPDATE public.organization_members
        SET role = invitation.role, seat_active = true
        WHERE org_id = invitation.organization_id AND user_id = auth.uid();
    ELSE
        -- Create new membership
        INSERT INTO public.organization_members (
            org_id,
            user_id,
            role
        ) VALUES (
            invitation.organization_id,
            auth.uid(),
            invitation.role
        );
    END IF;
    
    -- Mark invitation as accepted
    UPDATE public.organization_invitations
    SET status = 'accepted'
    WHERE id = invitation.id;
    
    RETURN json_build_object(
        'success', true,
        'organization_id', invitation.organization_id
    );
END;
$$;
