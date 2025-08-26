-- Ensure grants exist for organization_members SELECT policy functions
GRANT EXECUTE ON FUNCTION public.check_org_member_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_org_membership(uuid, uuid) TO authenticated;

-- Test function accessibility and verify policy works
DO $$
DECLARE
  current_user_id uuid;
  test_org_id uuid;
  access_result boolean;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NOT NULL THEN
    -- Get user's organization
    SELECT id INTO test_org_id 
    FROM public.organizations 
    WHERE owner_user_id = current_user_id 
    LIMIT 1;
    
    IF test_org_id IS NOT NULL THEN
      -- Test both functions work
      SELECT public.check_org_member_access(test_org_id, current_user_id) INTO access_result;
      RAISE NOTICE 'check_org_member_access test result: %', access_result;
      
      SELECT public.check_org_membership(test_org_id, current_user_id) INTO access_result;
      RAISE NOTICE 'check_org_membership test result: %', access_result;
    ELSE
      RAISE NOTICE 'No organization found for current user';
    END IF;
  ELSE
    RAISE NOTICE 'No authenticated user found for testing';
  END IF;
END $$;