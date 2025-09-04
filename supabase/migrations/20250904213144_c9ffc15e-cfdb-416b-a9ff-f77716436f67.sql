-- Fix the role mapping in log_org_update_attempt function to use only allowed constraint values
CREATE OR REPLACE FUNCTION public.log_org_update_attempt(p_org_id uuid, p_action text, p_user_id uuid DEFAULT auth.uid(), p_function_path text DEFAULT NULL::text, p_additional_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id uuid;
  user_role_snapshot text := 'user'; -- Default to 'user' which is allowed
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
    
    -- Map to constraint-allowed values only
    IF is_superadmin OR is_owner OR is_admin THEN
      user_role_snapshot := 'admin'; -- Map superadmin/owner/admin all to 'admin'
    ELSIF seat_active_status THEN
      user_role_snapshot := 'user'; -- Map member to 'user'
    ELSE
      user_role_snapshot := 'user'; -- Map non_member to 'user'
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
      ELSE 'error' 
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
        'actual_role', CASE 
          WHEN is_superadmin THEN 'superadmin'
          WHEN is_owner THEN 'owner'
          WHEN is_admin THEN 'admin'
          WHEN seat_active_status THEN 'member'
          ELSE 'non_member'
        END
      ),
      'attempt_timestamp', now()
    ) || p_additional_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$