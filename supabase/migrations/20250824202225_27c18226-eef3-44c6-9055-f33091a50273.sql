-- Continue with RLS fixes and destructive action function

-- 6. Now drop and recreate the organizations RLS policies to fix recursion
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;

-- Create new non-recursive policies
CREATE POLICY "organizations_select_policy" 
ON public.organizations FOR SELECT 
USING (
  public.check_org_ownership(id) OR 
  public.check_org_membership(id)
);

CREATE POLICY "organizations_update_policy" 
ON public.organizations FOR UPDATE 
USING (public.check_admin_access(id))
WITH CHECK (public.check_admin_access(id));

CREATE POLICY "organizations_delete_policy" 
ON public.organizations FOR DELETE 
USING (public.check_org_ownership(id));

CREATE POLICY "organizations_insert_policy" 
ON public.organizations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Create admin-only RPC for destructive operations
CREATE OR REPLACE FUNCTION public.admin_destructive_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_confirmation text,
  p_expected_confirmation text,
  p_org_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  has_access boolean;
  result jsonb;
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
    'timestamp', now()
  );
END;
$$;