-- Fix RLS issue for rate_limit_configs table
ALTER TABLE public.rate_limit_configs ENABLE ROW LEVEL SECURITY;

-- Create read-only policy for rate limit configs (admins can view)
CREATE POLICY "Admins can view rate limit configs" 
ON public.rate_limit_configs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE user_id = auth.uid()
  )
);

-- System can manage rate limit configs
CREATE POLICY "System can manage rate limit configs" 
ON public.rate_limit_configs 
FOR ALL 
USING (false);

-- Update admin functions to include rate limiting
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
  rate_limit_check jsonb;
BEGIN
  -- Check rate limiting first
  rate_limit_check := public.check_rate_limit('suspend_organization', p_suspended_by);
  IF NOT (rate_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rate limit exceeded',
      'error_code', 'rate_limited',
      'rate_limit_info', rate_limit_check
    );
  END IF;

  -- Check step-up authentication
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
      'step_up_verified', true,
      'rate_limit_info', rate_limit_check
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

-- Update reinstate_organization function with rate limiting
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
  rate_limit_check jsonb;
BEGIN
  -- Check rate limiting first
  rate_limit_check := public.check_rate_limit('reinstate_organization', p_reinstated_by);
  IF NOT (rate_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rate limit exceeded',
      'error_code', 'rate_limited',
      'rate_limit_info', rate_limit_check
    );
  END IF;

  -- Check step-up authentication
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
      'step_up_verified', true,
      'rate_limit_info', rate_limit_check
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

-- Update verify_step_up_auth function with rate limiting
CREATE OR REPLACE FUNCTION public.verify_step_up_auth(p_password text DEFAULT NULL, p_mfa_code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  session_token text;
  expires_at timestamptz;
  verification_method text;
  rate_limit_check jsonb;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check rate limiting first
  rate_limit_check := public.check_rate_limit('verify_step_up_auth', current_user_id);
  IF NOT (rate_limit_check->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rate limit exceeded',
      'error_code', 'rate_limited',
      'rate_limit_info', rate_limit_check
    );
  END IF;
  
  -- Determine verification method
  IF p_mfa_code IS NOT NULL THEN
    verification_method := 'mfa';
  ELSIF p_password IS NOT NULL THEN
    verification_method := 'password';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Either MFA code or password required');
  END IF;
  
  -- Generate session token and expiry (5 minutes)
  session_token := encode(gen_random_bytes(32), 'base64url');
  expires_at := now() + interval '5 minutes';
  
  -- Clean up expired sessions
  DELETE FROM public.step_up_sessions 
  WHERE user_id = current_user_id AND expires_at < now();
  
  -- Create new step-up session
  INSERT INTO public.step_up_sessions (user_id, expires_at, verification_method, session_token)
  VALUES (current_user_id, expires_at, verification_method, session_token);
  
  -- Log the step-up verification
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
    current_user_id,
    'admin',
    'auth.step_up_verified',
    'step_up_session',
    session_token,
    'success',
    'audit',
    jsonb_build_object(
      'verification_method', verification_method,
      'expires_at', expires_at,
      'timestamp', now(),
      'rate_limit_info', rate_limit_check
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'session_token', session_token,
    'expires_at', expires_at,
    'verification_method', verification_method
  );
END;
$$;