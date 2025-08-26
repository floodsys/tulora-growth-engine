-- Fix missing check_org_member_access function for organization_members SELECT policy
-- STEP 4: Create the missing function that wraps check_org_membership

CREATE OR REPLACE FUNCTION public.check_org_member_access(target_org_id uuid, target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Simply delegate to the existing check_org_membership function
  SELECT public.check_org_membership(target_org_id, target_user_id);
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_org_member_access(uuid, uuid) TO authenticated;

-- Test the function works correctly
DO $$
DECLARE
  test_result boolean;
BEGIN
  -- Test that the function exists and is callable
  SELECT public.check_org_member_access('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid) INTO test_result;
  RAISE NOTICE 'check_org_member_access function created successfully. Test call returned: %', test_result;
END $$;