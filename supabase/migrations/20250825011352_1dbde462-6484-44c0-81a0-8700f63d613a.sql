-- Add function to check if organization is active for RLS policies
CREATE OR REPLACE FUNCTION public.is_org_active(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(suspension_status, 'active') = 'active'
  FROM public.organizations
  WHERE id = org_id;
$$;

-- Update audit logging function to support blocked operations
CREATE OR REPLACE FUNCTION public.log_event(
  p_org_id uuid,
  p_action text,
  p_target_type text,
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_role_snapshot text DEFAULT 'user',
  p_target_id text DEFAULT NULL,
  p_status text DEFAULT 'success',
  p_channel text DEFAULT 'audit',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_error_code text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.audit_log (
    organization_id,
    actor_user_id,
    actor_role_snapshot,
    action,
    target_type,
    target_id,
    status,
    channel,
    metadata,
    error_code,
    request_id
  ) VALUES (
    p_org_id,
    p_actor_user_id,
    p_actor_role_snapshot,
    p_action,
    p_target_type,
    p_target_id,
    p_status,
    p_channel,
    p_metadata,
    p_error_code,
    p_request_id
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;