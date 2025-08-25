-- Update existing sensitive admin functions to require step-up auth

-- Update suspend_organization function
CREATE OR REPLACE FUNCTION public.suspend_organization(p_org_id uuid, p_reason text, p_suspended_by uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_name text;
  result jsonb;
  step_up_check jsonb;
BEGIN
  -- Check step-up authentication first
  step_up_check := public.require_step_up_auth('suspend_organization');
  IF NOT (step_up_check->>'success')::boolean THEN
    RETURN step_up_check;
  END IF;

  -- Verify admin has permission for this org
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_org_id AND owner_user_id = p_suspended_by
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_org_id 
        AND user_id = p_suspended_by 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get org name for logging
  SELECT name INTO org_name FROM public.organizations WHERE id = p_org_id;

  -- Update organization status
  UPDATE public.organizations 
  SET 
    suspension_status = 'suspended',
    suspension_reason = p_reason,
    suspended_at = now(),
    suspended_by = p_suspended_by
  WHERE id = p_org_id;

  -- Log the suspension
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
    p_suspended_by,
    'admin',
    'org.suspended',
    'organization',
    p_org_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'reason', p_reason,
      'organization_name', org_name,
      'suspended_at', now(),
      'step_up_verified', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'suspended_at', now(),
    'reason', p_reason
  );
END;
$$;

-- Update reinstate_organization function
CREATE OR REPLACE FUNCTION public.reinstate_organization(p_org_id uuid, p_reason text, p_reinstated_by uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_name text;
  result jsonb;
  step_up_check jsonb;
BEGIN
  -- Check step-up authentication first
  step_up_check := public.require_step_up_auth('reinstate_organization');
  IF NOT (step_up_check->>'success')::boolean THEN
    RETURN step_up_check;
  END IF;

  -- Verify admin has permission for this org
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_org_id AND owner_user_id = p_reinstated_by
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_org_id 
        AND user_id = p_reinstated_by 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get org name for logging
  SELECT name INTO org_name FROM public.organizations WHERE id = p_org_id;

  -- Update organization status
  UPDATE public.organizations 
  SET 
    suspension_status = 'active',
    suspension_reason = NULL,
    suspended_at = NULL,
    suspended_by = NULL
  WHERE id = p_org_id;

  -- Log the reinstatement
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
    p_reinstated_by,
    'admin',
    'org.reinstated',
    'organization',
    p_org_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'reason', p_reason,
      'organization_name', org_name,
      'reinstated_at', now(),
      'step_up_verified', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'reinstated_at', now(),
    'reason', p_reason
  );
END;
$$;

-- Update cancel_organization function
CREATE OR REPLACE FUNCTION public.cancel_organization(p_org_id uuid, p_reason text, p_canceled_by uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_name text;
  result jsonb;
  step_up_check jsonb;
BEGIN
  -- Check step-up authentication first
  step_up_check := public.require_step_up_auth('cancel_organization');
  IF NOT (step_up_check->>'success')::boolean THEN
    RETURN step_up_check;
  END IF;

  -- Verify admin has permission for this org
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_org_id AND owner_user_id = p_canceled_by
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_org_id 
        AND user_id = p_canceled_by 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get org name for logging
  SELECT name INTO org_name FROM public.organizations WHERE id = p_org_id;

  -- Update organization status
  UPDATE public.organizations 
  SET 
    suspension_status = 'canceled',
    suspension_reason = p_reason,
    canceled_at = now(),
    suspended_by = p_canceled_by
  WHERE id = p_org_id;

  -- Log the cancellation
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
    p_canceled_by,
    'admin',
    'org.canceled',
    'organization',
    p_org_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'reason', p_reason,
      'organization_name', org_name,
      'canceled_at', now(),
      'step_up_verified', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'canceled_at', now(),
    'reason', p_reason
  );
END;
$$;

-- Update admin_destructive_action function
CREATE OR REPLACE FUNCTION public.admin_destructive_action(p_action text, p_target_type text, p_target_id text, p_reason text, p_confirmation text, p_expected_confirmation text, p_org_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  has_access boolean;
  result jsonb;
  step_up_check jsonb;
BEGIN
  current_user_id := auth.uid();
  
  -- Check authentication
  IF current_user_id IS NULL THEN
    PERFORM public.log_unauthorized_access(p_action, p_target_type, NULL, p_org_id);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required',
      'error_code', 'not_authenticated'
    );
  END IF;
  
  -- Check step-up authentication first
  step_up_check := public.require_step_up_auth(p_action);
  IF NOT (step_up_check->>'success')::boolean THEN
    RETURN step_up_check;
  END IF;
  
  -- Check authorization
  IF p_org_id IS NOT NULL THEN
    has_access := public.check_admin_access(p_org_id, current_user_id);
  ELSE
    has_access := public.is_superadmin(current_user_id);
  END IF;
  
  IF NOT has_access THEN
    PERFORM public.log_unauthorized_access(p_action, p_target_type, current_user_id, p_org_id);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions',
      'error_code', 'not_authorized'
    );
  END IF;
  
  -- Validate confirmation text
  IF p_confirmation != p_expected_confirmation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Confirmation text does not match',
      'error_code', 'invalid_confirmation'
    );
  END IF;
  
  -- Validate reason is provided
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reason is required for destructive actions',
      'error_code', 'reason_required'
    );
  END IF;
  
  -- Log the destructive action (before execution)
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
    COALESCE(p_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    current_user_id,
    CASE WHEN public.is_superadmin(current_user_id) THEN 'superadmin' ELSE 'admin' END,
    p_action,
    p_target_type,
    p_target_id,
    'success',
    'internal',
    jsonb_build_object(
      'reason', p_reason,
      'confirmation', p_confirmation,
      'destructive_action', true,
      'step_up_verified', true,
      'metadata', p_metadata,
      'timestamp', now()
    )
  );
  
  -- Return success (actual action implementation would go here)
  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'target_type', p_target_type,
    'target_id', p_target_id,
    'reason', p_reason,
    'step_up_verified', true,
    'timestamp', now()
  );
END;
$$;