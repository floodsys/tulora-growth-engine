-- Fix check_admin_access and check_org_membership functions to avoid parameter shadowing

-- Use CREATE OR REPLACE instead of DROP to avoid breaking dependent RLS policies

-- Create fixed check_admin_access function (keep original param names to avoid rename error)
CREATE OR REPLACE FUNCTION public.check_admin_access(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND o.owner_user_id = COALESCE(check_admin_access.user_id, auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = COALESCE(check_admin_access.user_id, auth.uid())
      AND om.role = 'admin'::org_role 
      AND om.seat_active = true
  );
$$;

-- Create fixed check_org_membership function (keep original param names to avoid rename error)
CREATE OR REPLACE FUNCTION public.check_org_membership(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_id AND o.owner_user_id = COALESCE(check_org_membership.user_id, auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = COALESCE(check_org_membership.user_id, auth.uid())
      AND om.seat_active = true
  );
$$;

-- Set proper ownership
ALTER FUNCTION public.check_admin_access(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.check_org_membership(uuid, uuid) OWNER TO postgres;

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
  
  test_results := jsonb_build_object(
    'test_org_id', test_org_id,
    'test_user_id', test_user_id,
    'admin_access_for_non_member', admin_result,
    'membership_for_non_member', member_result,
    'tests_passed', (NOT admin_result AND NOT member_result),
    'timestamp', now()
  );
  
  -- Log test results
  INSERT INTO public.audit_log (
    organization_id,
    actor_user_id,
    actor_role_snapshot,
    action,
    target_type,
    target_id,
    status,
    channel,
    metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'system',
    'rls.function_test',
    'security_functions',
    'check_admin_access,check_org_membership',
    CASE WHEN (NOT admin_result AND NOT member_result) THEN 'success' ELSE 'error' END,
    'internal',
    test_results
  );
  
  RETURN test_results;
END;
$$;

ALTER FUNCTION public.test_rls_functions() OWNER TO postgres;
