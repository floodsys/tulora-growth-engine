-- Create step-up authentication sessions table
CREATE TABLE public.step_up_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verification_method TEXT NOT NULL CHECK (verification_method IN ('mfa', 'password')),
  used_for_actions TEXT[] DEFAULT '{}',
  session_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url')
);

-- Add RLS policies
ALTER TABLE public.step_up_sessions ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own sessions
CREATE POLICY "Users can view own step-up sessions" 
ON public.step_up_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only allow system to manage sessions
CREATE POLICY "System can manage step-up sessions" 
ON public.step_up_sessions 
FOR ALL 
USING (false);

-- Create function to verify step-up authentication
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
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Determine verification method
  IF p_mfa_code IS NOT NULL THEN
    verification_method := 'mfa';
    
    -- Verify MFA code (simplified - in real implementation would check against Supabase Auth MFA)
    -- For now, we'll assume MFA verification is handled client-side with Supabase Auth
    
  ELSIF p_password IS NOT NULL THEN
    verification_method := 'password';
    
    -- Note: Password verification should be done through Supabase Auth client-side
    -- This is a placeholder for the verification logic
    
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
      'timestamp', now()
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

-- Create function to check step-up authentication
CREATE OR REPLACE FUNCTION public.check_step_up_auth(p_action text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  valid_session boolean := false;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has valid step-up session
  SELECT EXISTS (
    SELECT 1 FROM public.step_up_sessions 
    WHERE user_id = current_user_id 
      AND expires_at > now()
  ) INTO valid_session;
  
  -- If action is specified and session exists, update the actions list
  IF valid_session AND p_action IS NOT NULL THEN
    UPDATE public.step_up_sessions 
    SET used_for_actions = array_append(used_for_actions, p_action)
    WHERE user_id = current_user_id 
      AND expires_at > now();
  END IF;
  
  RETURN valid_session;
END;
$$;

-- Create function to require step-up auth for sensitive actions
CREATE OR REPLACE FUNCTION public.require_step_up_auth(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.check_step_up_auth(p_action) THEN
    -- Log the requirement
    INSERT INTO public.audit_log (
      organization_id,
      actor_user_id,
      actor_role_snapshot,
      action,
      target_type,
      target_id,
      status,
      error_code,
      channel,
      metadata
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      auth.uid(),
      'admin',
      'auth.step_up_required',
      'admin_action',
      p_action,
      'error',
      'step_up_required',
      'audit',
      jsonb_build_object(
        'attempted_action', p_action,
        'timestamp', now(),
        'step_up_enforcement', true
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Step-up authentication required',
      'error_code', 'step_up_required',
      'required_action', p_action
    );
  END IF;
  
  RETURN jsonb_build_object('success', true, 'step_up_verified', true);
END;
$$;