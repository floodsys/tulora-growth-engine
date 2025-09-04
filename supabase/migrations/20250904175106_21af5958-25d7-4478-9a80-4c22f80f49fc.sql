-- SECURITY FIX: Fix organization_members RLS policies to prevent public access
-- The current policies have recursive dependencies and incorrect logic that allows public access

-- Drop the problematic policies first
DROP POLICY IF EXISTS "organization_members_select_policy_fixed" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy_minimal" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy_minimal" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy_minimal" ON public.organization_members;

-- Create a secure function that checks if current user is an org admin without recursion
CREATE OR REPLACE FUNCTION public.check_org_admin_no_recursion(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is organization owner
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND owner_user_id = auth.uid()
  );
$$;

-- Create a secure function to check if user can access specific membership record
CREATE OR REPLACE FUNCTION public.can_access_membership(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Users can only see their own membership records OR if they're the org owner
  SELECT (auth.uid() = p_user_id) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND owner_user_id = auth.uid()
  );
$$;

-- Create new secure policies
-- Users can only SELECT their own membership records or if they're org owner
CREATE POLICY "Members can view own records and admins can view all"
ON public.organization_members
FOR SELECT
TO authenticated
USING (can_access_membership(organization_id, user_id));

-- Only org owners can INSERT new members
CREATE POLICY "Only org owners can add members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (check_org_admin_no_recursion(organization_id));

-- Only org owners can UPDATE member records
CREATE POLICY "Only org owners can update members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (check_org_admin_no_recursion(organization_id))
WITH CHECK (check_org_admin_no_recursion(organization_id));

-- Only org owners can DELETE member records
CREATE POLICY "Only org owners can remove members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (check_org_admin_no_recursion(organization_id));