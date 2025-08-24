-- Create superadmin system for platform administration
-- This creates the infrastructure for platform-level admin access

-- Create superadmins table
CREATE TABLE IF NOT EXISTS public.superadmins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on superadmins table
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- Create policies for superadmins table (only superadmins can manage)
CREATE POLICY "superadmins_select_policy" ON public.superadmins
  FOR SELECT USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins_insert_policy" ON public.superadmins
  FOR INSERT WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins_update_policy" ON public.superadmins
  FOR UPDATE USING (public.is_superadmin(auth.uid()));

CREATE POLICY "superadmins_delete_policy" ON public.superadmins
  FOR DELETE USING (public.is_superadmin(auth.uid()));

-- Update the is_superadmin function to check both email allowlist and superadmins table
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
  allowlisted_emails text[];
BEGIN
  -- Return false if no user provided
  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is in superadmins table
  IF EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE superadmins.user_id = is_superadmin.user_id
  ) THEN
    RETURN true;
  END IF;

  -- Get user email from auth.users (using security definer to access auth schema)
  SELECT email INTO user_email
  FROM auth.users 
  WHERE id = is_superadmin.user_id;

  -- Return false if no email found
  IF user_email IS NULL THEN
    RETURN false;
  END IF;

  -- Check against environment variable allowlist
  -- Note: In production, SUPERADMINS_EMAILS should be set as a comma-separated list
  -- This is a fallback check in case the superadmins table is empty
  SELECT string_to_array(current_setting('app.superadmin_emails', true), ',') INTO allowlisted_emails;
  
  IF allowlisted_emails IS NOT NULL AND user_email = ANY(allowlisted_emails) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- Create function to bootstrap first superadmin
CREATE OR REPLACE FUNCTION public.bootstrap_superadmin(p_bootstrap_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  user_email text;
  expected_token text;
  bootstrap_enabled boolean;
  result jsonb;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User must be authenticated'
    );
  END IF;

  -- Check if bootstrap is enabled
  SELECT current_setting('app.admin_bootstrap_enabled', true)::boolean INTO bootstrap_enabled;
  
  IF NOT COALESCE(bootstrap_enabled, false) THEN
    -- Log failed attempt
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
      current_user_id,
      'user',
      'superadmin.bootstrap_failed',
      'superadmin',
      current_user_id::text,
      'error',
      'bootstrap_disabled',
      'internal',
      jsonb_build_object(
        'reason', 'Bootstrap is disabled',
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bootstrap is not enabled'
    );
  END IF;

  -- Validate bootstrap token
  expected_token := current_setting('app.admin_bootstrap_token', true);
  
  IF expected_token IS NULL OR p_bootstrap_token != expected_token THEN
    -- Log failed attempt
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
      current_user_id,
      'user',
      'superadmin.bootstrap_failed',
      'superadmin',
      current_user_id::text,
      'error',
      'invalid_token',
      'internal',
      jsonb_build_object(
        'reason', 'Invalid bootstrap token',
        'timestamp', now()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid bootstrap token'
    );
  END IF;

  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;

  -- Add user to superadmins (idempotent)
  INSERT INTO public.superadmins (user_id, added_by)
  VALUES (current_user_id, current_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Log successful bootstrap
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
    'superadmin',
    'superadmin.bootstrap_succeeded',
    'superadmin',
    current_user_id::text,
    'success',
    'internal',
    jsonb_build_object(
      'email', user_email,
      'timestamp', now(),
      'auto_disabled', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', current_user_id,
    'message', 'Superadmin access granted. Bootstrap will be automatically disabled.'
  );
END;
$function$;

-- Create function to add superadmin
CREATE OR REPLACE FUNCTION public.add_superadmin(p_user_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  target_user_id uuid;
  result jsonb;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  -- Check if current user is superadmin
  IF NOT public.is_superadmin(current_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions. Only superadmins can add other superadmins.'
    );
  END IF;

  -- Find target user by email
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = p_user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found with email: ' || p_user_email
    );
  END IF;

  -- Add user to superadmins (idempotent)
  INSERT INTO public.superadmins (user_id, added_by)
  VALUES (target_user_id, current_user_id)
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now();

  -- Log the action
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
    'superadmin',
    'superadmin.added',
    'superadmin',
    target_user_id::text,
    'success',
    'internal',
    jsonb_build_object(
      'target_email', p_user_email,
      'added_by', current_user_id,
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', target_user_id,
    'message', 'User successfully added as superadmin.'
  );
END;
$function$;

-- Create function to remove superadmin
CREATE OR REPLACE FUNCTION public.remove_superadmin(p_user_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  target_user_id uuid;
  remaining_count integer;
  result jsonb;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  -- Check if current user is superadmin
  IF NOT public.is_superadmin(current_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions. Only superadmins can remove other superadmins.'
    );
  END IF;

  -- Find target user by email
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = p_user_email;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found with email: ' || p_user_email
    );
  END IF;

  -- Prevent removing self if it would leave no superadmins
  SELECT COUNT(*) INTO remaining_count 
  FROM public.superadmins;

  IF remaining_count <= 1 AND target_user_id = current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot remove the last superadmin. Add another superadmin first.'
    );
  END IF;

  -- Remove user from superadmins
  DELETE FROM public.superadmins 
  WHERE user_id = target_user_id;

  -- Log the action
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
    'superadmin',
    'superadmin.removed',
    'superadmin',
    target_user_id::text,
    'success',
    'internal',
    jsonb_build_object(
      'target_email', p_user_email,
      'removed_by', current_user_id,
      'timestamp', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', target_user_id,
    'message', 'User successfully removed from superadmins.'
  );
END;
$function$;