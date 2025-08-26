-- Fix RLS policies to be explicit and minimal as requested

-- Update organization_members policies to use check_admin_access for writes
DROP POLICY IF EXISTS "organization_members_delete_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON public.organization_members;

-- Create minimal RLS policies for organization_members
-- Members can read their own membership; admins can read all
CREATE POLICY "organization_members_select_policy_minimal" ON public.organization_members
FOR SELECT USING (
  check_org_member_access(organization_id, user_id)
);

-- Only admins/owners can insert members
CREATE POLICY "organization_members_insert_policy_minimal" ON public.organization_members
FOR INSERT WITH CHECK (
  check_admin_access(organization_id)
);

-- Only admins/owners can update members
CREATE POLICY "organization_members_update_policy_minimal" ON public.organization_members
FOR UPDATE USING (
  check_admin_access(organization_id)
) WITH CHECK (
  check_admin_access(organization_id)
);

-- Only admins/owners can delete members
CREATE POLICY "organization_members_delete_policy_minimal" ON public.organization_members
FOR DELETE USING (
  check_admin_access(organization_id)
);

-- Update organizations policies to use functions without user parameter (as requested)
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON public.organizations;

-- Recreate with minimal, explicit policies
CREATE POLICY "organizations_update_policy_minimal" ON public.organizations
FOR UPDATE USING (
  check_admin_access(id)
) WITH CHECK (
  check_admin_access(id)
);

CREATE POLICY "organizations_delete_policy_minimal" ON public.organizations
FOR DELETE USING (
  check_org_ownership(id)
);

-- Run unit test to verify functions work correctly
SELECT public.test_rls_functions() as test_results;