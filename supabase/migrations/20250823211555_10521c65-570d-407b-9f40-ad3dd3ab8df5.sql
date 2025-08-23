-- Enable RLS on all organization tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Create security helper function to check if user is org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Check if user is the owner of the organization
    SELECT 1
    FROM public.organizations
    WHERE id = org_uuid
      AND owner_user_id = auth.uid()
  ) OR EXISTS (
    -- Check if user is an admin member of the organization
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = org_uuid
      AND user_id = auth.uid()
      AND role = 'admin'::public.org_role
      AND seat_active = true
  );
$$;

-- Create security helper function to check if user is org member
CREATE OR REPLACE FUNCTION public.is_org_member(org_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Check if user is the owner of the organization
    SELECT 1
    FROM public.organizations
    WHERE id = org_uuid
      AND owner_user_id = auth.uid()
  ) OR EXISTS (
    -- Check if user is any member of the organization
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = org_uuid
      AND user_id = auth.uid()
      AND seat_active = true
  );
$$;

-- Drop existing policies to make this idempotent
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_invitations_select_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_insert_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_update_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_delete_policy" ON public.organization_invitations;

-- ORGANIZATIONS POLICIES
-- SELECT: allowed if current user is the owner or is a member of that org
CREATE POLICY "organizations_select_policy" ON public.organizations
    FOR SELECT USING (is_org_member(id));

-- UPDATE: allowed only if is_org_admin(org_id)
CREATE POLICY "organizations_update_policy" ON public.organizations
    FOR UPDATE USING (is_org_admin(id));

-- INSERT: allow authenticated users to create organizations
CREATE POLICY "organizations_insert_policy" ON public.organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ORGANIZATION_MEMBERS POLICIES
-- SELECT: allowed to any member of the same organization_id
CREATE POLICY "organization_members_select_policy" ON public.organization_members
    FOR SELECT USING (is_org_member(organization_id));

-- INSERT: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_members_insert_policy" ON public.organization_members
    FOR INSERT WITH CHECK (is_org_admin(organization_id));

-- UPDATE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_members_update_policy" ON public.organization_members
    FOR UPDATE USING (is_org_admin(organization_id));

-- DELETE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_members_delete_policy" ON public.organization_members
    FOR DELETE USING (is_org_admin(organization_id));

-- ORGANIZATION_INVITATIONS POLICIES
-- SELECT: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_select_policy" ON public.organization_invitations
    FOR SELECT USING (is_org_admin(organization_id));

-- INSERT: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_insert_policy" ON public.organization_invitations
    FOR INSERT WITH CHECK (is_org_admin(organization_id));

-- UPDATE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_update_policy" ON public.organization_invitations
    FOR UPDATE USING (is_org_admin(organization_id));

-- DELETE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_delete_policy" ON public.organization_invitations
    FOR DELETE USING (is_org_admin(organization_id));