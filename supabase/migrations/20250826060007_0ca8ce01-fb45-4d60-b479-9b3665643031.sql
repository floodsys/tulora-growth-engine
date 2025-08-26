-- Add audit logging for organization update attempts
-- This logs role snapshot, seat_active status, and function path used

CREATE OR REPLACE FUNCTION public.log_org_update_attempt(
  p_org_id uuid,
  p_action text,
  p_user_id uuid DEFAULT auth.uid(),
  p_function_path text DEFAULT NULL,
  p_additional_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id uuid;
  user_role_snapshot text := 'unauthorized';
  seat_active_status boolean := false;
  is_owner boolean := false;
  is_admin boolean := false;
  is_superadmin boolean := false;
  org_name text;
BEGIN
  -- Get organization name for context
  SELECT name INTO org_name FROM public.organizations WHERE id = p_org_id;
  
  -- Determine user's role and access status
  IF p_user_id IS NOT NULL THEN
    -- Check if user is organization owner
    SELECT EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_org_id AND owner_user_id = p_user_id
    ) INTO is_owner;
    
    -- Check if user is admin member
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_org_id 
        AND user_id = p_user_id 
        AND role = 'admin'::org_role 
        AND seat_active = true
    ) INTO is_admin;
    
    -- Get seat status if member
    SELECT seat_active INTO seat_active_status
    FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = p_user_id;
    
    -- Check superadmin status
    SELECT public.is_superadmin(p_user_id) INTO is_superadmin;
    
    -- Determine role snapshot
    IF is_superadmin THEN
      user_role_snapshot := 'superadmin';
    ELSIF is_owner THEN
      user_role_snapshot := 'owner';
    ELSIF is_admin THEN
      user_role_snapshot := 'admin';
    ELSIF seat_active_status THEN
      user_role_snapshot := 'member';
    ELSE
      user_role_snapshot := 'non_member';
    END IF;
  END IF;
  
  -- Log the audit event
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
    p_org_id,
    p_user_id,
    user_role_snapshot,
    p_action,
    'organization',
    p_org_id::text,
    CASE 
      WHEN is_superadmin OR is_owner OR is_admin THEN 'success'
      ELSE 'blocked' 
    END,
    'audit',
    jsonb_build_object(
      'organization_name', org_name,
      'function_path', p_function_path,
      'access_evaluation', jsonb_build_object(
        'is_owner', is_owner,
        'is_admin', is_admin,
        'is_superadmin', is_superadmin,
        'seat_active', seat_active_status,
        'role_snapshot', user_role_snapshot
      ),
      'attempt_timestamp', now()
    ) || p_additional_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Add trigger to automatically log organization update attempts
CREATE OR REPLACE FUNCTION public.audit_org_update_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log the update attempt with change details
  PERFORM public.log_org_update_attempt(
    NEW.id,
    'org.settings_updated',
    auth.uid(),
    'trigger_automatic',
    jsonb_build_object(
      'changes', jsonb_build_object(
        'old_values', to_jsonb(OLD),
        'new_values', to_jsonb(NEW)
      ),
      'update_method', 'database_trigger'
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Create the trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS audit_org_updates ON public.organizations;
CREATE TRIGGER audit_org_updates
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_org_update_trigger();

-- Function to test RLS regression - should always return false for random UUIDs
CREATE OR REPLACE FUNCTION public.test_rls_regression_tripwire(
  p_random_org_id uuid DEFAULT gen_random_uuid(),
  p_random_user_id uuid DEFAULT gen_random_uuid()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  test_results jsonb := '[]'::jsonb;
  admin_result boolean;
  member_result boolean;
  owner_result boolean;
  superadmin_result boolean;
BEGIN
  -- Test check_admin_access with random UUID - should be false
  BEGIN
    SELECT public.check_admin_access(p_random_org_id, p_random_user_id) INTO admin_result;
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'check_admin_access',
      'params', jsonb_build_object('org_id', p_random_org_id, 'user_id', p_random_user_id),
      'result', admin_result,
      'expected', false,
      'passed', (admin_result = false),
      'description', 'Should return false for random UUIDs'
    ));
  EXCEPTION WHEN OTHERS THEN
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'check_admin_access',
      'error', SQLERRM,
      'passed', false
    ));
  END;
  
  -- Test check_org_membership with random UUID - should be false
  BEGIN
    SELECT public.check_org_membership(p_random_org_id, p_random_user_id) INTO member_result;
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'check_org_membership',
      'params', jsonb_build_object('org_id', p_random_org_id, 'user_id', p_random_user_id),
      'result', member_result,
      'expected', false,
      'passed', (member_result = false),
      'description', 'Should return false for random UUIDs'
    ));
  EXCEPTION WHEN OTHERS THEN
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'check_org_membership',
      'error', SQLERRM,
      'passed', false
    ));
  END;
  
  -- Test check_org_ownership with random UUID - should be false
  BEGIN
    SELECT public.check_org_ownership(p_random_org_id, p_random_user_id) INTO owner_result;
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'check_org_ownership',
      'params', jsonb_build_object('org_id', p_random_org_id, 'user_id', p_random_user_id),
      'result', owner_result,
      'expected', false,
      'passed', (owner_result = false),
      'description', 'Should return false for random UUIDs'
    ));
  EXCEPTION WHEN OTHERS THEN
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'check_org_ownership',
      'error', SQLERRM,
      'passed', false
    ));
  END;
  
  -- Test is_superadmin with random UUID - should be false
  BEGIN
    SELECT public.is_superadmin(p_random_user_id) INTO superadmin_result;
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'is_superadmin',
      'params', jsonb_build_object('user_id', p_random_user_id),
      'result', superadmin_result,
      'expected', false,
      'passed', (superadmin_result = false),
      'description', 'Should return false for random UUIDs'
    ));
  EXCEPTION WHEN OTHERS THEN
    test_results := test_results || jsonb_build_array(jsonb_build_object(
      'function', 'is_superadmin',
      'error', SQLERRM,
      'passed', false
    ));
  END;
  
  RETURN jsonb_build_object(
    'test_type', 'rls_regression_tripwire',
    'timestamp', now(),
    'test_params', jsonb_build_object(
      'random_org_id', p_random_org_id,
      'random_user_id', p_random_user_id
    ),
    'results', test_results,
    'summary', jsonb_build_object(
      'total_tests', jsonb_array_length(test_results),
      'passed', (
        SELECT COUNT(*)::int FROM jsonb_array_elements(test_results) AS t 
        WHERE (t->>'passed')::boolean = true
      ),
      'purpose', 'Prevent tautology bugs like user_id = user_id'
    )
  );
END;
$function$;