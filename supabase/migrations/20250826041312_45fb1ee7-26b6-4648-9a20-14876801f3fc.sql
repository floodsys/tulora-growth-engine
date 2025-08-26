-- Fix check_admin_access and check_org_membership functions to avoid parameter shadowing
-- Handle dependencies by dropping and recreating policies

-- First, drop policies that depend on the functions
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON public.organizations;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.check_admin_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.check_org_membership(uuid, uuid);
DROP FUNCTION IF EXISTS public.check_org_ownership(uuid, uuid);

-- Create fixed check_admin_access function
CREATE OR REPLACE FUNCTION public.check_admin_access(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_user_id = COALESCE(p_user_id, auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id 
      AND om.user_id = COALESCE(p_user_id, auth.uid())
      AND om.role = 'admin'::org_role 
      AND om.seat_active = true
  );
$$;

-- Create fixed check_org_membership function
CREATE OR REPLACE FUNCTION public.check_org_membership(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_user_id = COALESCE(p_user_id, auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id 
      AND om.user_id = COALESCE(p_user_id, auth.uid())
      AND om.seat_active = true
  );
$$;

-- Create check_org_ownership function (used by policies)
CREATE OR REPLACE FUNCTION public.check_org_ownership(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_user_id = COALESCE(p_user_id, auth.uid())
  );
$$;

-- Set proper ownership
ALTER FUNCTION public.check_admin_access(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.check_org_membership(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.check_org_ownership(uuid, uuid) OWNER TO postgres;

-- Recreate the RLS policies using the fixed functions
CREATE POLICY "organizations_select_policy" ON public.organizations
FOR SELECT USING (
  check_org_ownership(id) OR check_org_membership(id)
);

CREATE POLICY "organizations_update_policy" ON public.organizations
FOR UPDATE USING (
  check_admin_access(id)
) WITH CHECK (
  check_admin_access(id)
);

CREATE POLICY "organizations_delete_policy" ON public.organizations
FOR DELETE USING (
  check_org_ownership(id)
);

-- Add unit test function to verify non-members return false
CREATE OR REPLACE FUNCTION public.test_rls_functions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  test_org_id uuid;
  test_user_id uuid := '00000000-0000-0000-0000-000000000001'::uuid; -- Non-existent user
  admin_result boolean;
  member_result boolean;
  ownership_result boolean;
  test_results jsonb;
BEGIN
  -- Get a random org for testing
  SELECT id INTO test_org_id FROM public.organizations LIMIT 1;
  
  IF test_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No organizations found for testing',
      'timestamp', now()
    );
  END IF;
  
  -- Test that non-member returns false for admin access
  SELECT public.check_admin_access(test_org_id, test_user_id) INTO admin_result;
  
  -- Test that non-member returns false for membership
  SELECT public.check_org_membership(test_org_id, test_user_id) INTO member_result;
  
  -- Test that non-owner returns false for ownership
  SELECT public.check_org_ownership(test_org_id, test_user_id) INTO ownership_result;
  
  test_results := jsonb_build_object(
    'test_org_id', test_org_id,
    'test_user_id', test_user_id,
    'admin_access_for_non_member', admin_result,
    'membership_for_non_member', member_result,
    'ownership_for_non_owner', ownership_result,
    'all_tests_passed', (NOT admin_result AND NOT member_result AND NOT ownership_result),
    'timestamp', now()
  );
  
  RETURN test_results;
END;
$$;

ALTER FUNCTION public.test_rls_functions() OWNER TO postgres;