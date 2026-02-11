-- NOTE: Removed DROP FUNCTION - it fails due to dependent policies and is unnecessary
-- when using CREATE OR REPLACE with matching parameter names

-- Create role enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create organizations table if it doesn't exist (ensure it has all needed columns)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations' AND table_schema = 'public') THEN
CREATE TABLE IF NOT EXISTS public.organizations (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      name text NOT NULL,
      owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  END IF;
  
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'owner_user_id' AND table_schema = 'public') THEN
    ALTER TABLE public.organizations ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create organization_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL,
  seat_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Create organization_invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function: is_org_admin
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = $1 
      AND o.owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = $1
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  );
$$;

-- Helper function: is_org_member
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = $1 
      AND o.owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.org_id = $1
      AND om.user_id = auth.uid()
  );
$$;

-- RLS Policies for organizations
DROP POLICY IF EXISTS "orgs_select_members" ON public.organizations;
CREATE POLICY "orgs_select_members" ON public.organizations
  FOR SELECT USING (
    owner_user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = organizations.id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "orgs_update_admins" ON public.organizations;
CREATE POLICY "orgs_update_admins" ON public.organizations
  FOR UPDATE USING (is_org_admin(id));

DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.organizations;
CREATE POLICY "orgs_insert_authenticated" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for organization_members
DROP POLICY IF EXISTS "members_select_org_members" ON public.organization_members;
CREATE POLICY "members_select_org_members" ON public.organization_members
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS "members_insert_admins" ON public.organization_members;
CREATE POLICY "members_insert_admins" ON public.organization_members
  FOR INSERT WITH CHECK (is_org_admin(org_id));

DROP POLICY IF EXISTS "members_update_admins" ON public.organization_members;
CREATE POLICY "members_update_admins" ON public.organization_members
  FOR UPDATE USING (is_org_admin(org_id));

DROP POLICY IF EXISTS "members_delete_admins" ON public.organization_members;
CREATE POLICY "members_delete_admins" ON public.organization_members
  FOR DELETE USING (is_org_admin(org_id));

-- RLS Policies for organization_invitations
DROP POLICY IF EXISTS "invites_select_admins" ON public.organization_invitations;
CREATE POLICY "invites_select_admins" ON public.organization_invitations
  FOR SELECT USING (is_org_admin(organization_id));

DROP POLICY IF EXISTS "invites_insert_admins" ON public.organization_invitations;
CREATE POLICY "invites_insert_admins" ON public.organization_invitations
  FOR INSERT WITH CHECK (is_org_admin(organization_id));

DROP POLICY IF EXISTS "invites_update_admins" ON public.organization_invitations;
CREATE POLICY "invites_update_admins" ON public.organization_invitations
  FOR UPDATE USING (is_org_admin(organization_id));

DROP POLICY IF EXISTS "invites_delete_admins" ON public.organization_invitations;
CREATE POLICY "invites_delete_admins" ON public.organization_invitations
  FOR DELETE USING (is_org_admin(organization_id));

-- RPC: create_invite
CREATE OR REPLACE FUNCTION public.create_invite(
  p_org uuid,
  p_email text,
  p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite_id uuid;
  v_invite_token text;
  v_expires_at timestamptz;
BEGIN
  -- Check if user is org admin
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Access denied: Only organization admins can create invites';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'editor', 'viewer', 'user') THEN
    RAISE EXCEPTION 'Invalid role: must be admin, editor, viewer, or user';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.org_id = p_org AND u.email = p_email
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Revoke any existing pending invites for this email/org
  UPDATE public.organization_invitations
  SET status = 'revoked'
  WHERE organization_id = p_org 
    AND email = p_email 
    AND status = 'pending';

  -- Create new invite
  INSERT INTO public.organization_invitations (
    organization_id,
    email,
    role,
    invited_by,
    invite_token,
    expires_at
  ) VALUES (
    p_org,
    p_email,
    p_role::public.org_role,
    auth.uid(),
    encode(gen_random_bytes(32), 'hex'),
    now() + interval '7 days'
  )
  RETURNING id, invite_token, expires_at
  INTO v_invite_id, v_invite_token, v_expires_at;

  RETURN json_build_object(
    'id', v_invite_id,
    'invite_token', v_invite_token,
    'expires_at', v_expires_at
  );
END;
$$;

-- RPC: accept_invite
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite record;
  v_user_email text;
BEGIN
  -- Get current user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get invitation details
  SELECT * INTO v_invite
  FROM public.organization_invitations
  WHERE invite_token = p_token
    AND status = 'pending'
    AND expires_at > now()
    AND email = v_user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or unauthorized invitation token';
  END IF;

  -- Insert or update membership
  INSERT INTO public.organization_members (
    org_id,
    user_id,
    role
  ) VALUES (
    v_invite.organization_id,
    auth.uid(),
    v_invite.role
  )
  ON CONFLICT (org_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE public.organization_invitations
  SET status = 'accepted'
  WHERE id = v_invite.id;

  RETURN json_build_object(
    'organization_id', v_invite.organization_id,
    'role', v_invite.role
  );
END;
$$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to organizations
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
