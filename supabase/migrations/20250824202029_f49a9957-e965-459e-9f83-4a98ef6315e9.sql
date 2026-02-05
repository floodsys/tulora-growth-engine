-- Fix infinite recursion in organizations RLS and create proper admin security functions

-- 1. First, create secure functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- For now, use a simple check - can be extended later with a superadmin table
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.owner_user_id = user_id
      AND o.id = (
        SELECT MIN(id) FROM public.organizations 
        WHERE owner_user_id = user_id
      )
  );
$$;

-- 2. Create function to check org ownership without recursion
CREATE OR REPLACE FUNCTION public.check_org_ownership(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER  
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND owner_user_id = user_id
  );
$$;

-- 3. Create function to check org membership without recursion
CREATE OR REPLACE FUNCTION public.check_org_membership(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
      AND organization_members.user_id = check_org_membership.user_id 
      AND seat_active = true
  );
$$;

-- 4. Create function to check admin access without recursion
CREATE OR REPLACE FUNCTION public.check_admin_access(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- Check if user is org owner
    public.check_org_ownership(org_id, user_id) OR
    -- Check if user is admin member
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = org_id 
        AND organization_members.user_id = check_admin_access.user_id 
        AND role = 'admin'::org_role
        AND seat_active = true
    ) OR
    -- Check if user is superadmin
    public.is_superadmin(user_id)
  );
$$;

-- 5. Log unauthorized access attempts
CREATE OR REPLACE FUNCTION public.log_unauthorized_access(
  p_attempted_action text,
  p_attempted_resource text,
  p_user_id uuid DEFAULT auth.uid(),
  p_org_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert into audit log for tracking unauthorized attempts
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
    COALESCE(p_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_user_id,
    'unauthorized',
    'access.denied',
    'admin_resource',
    p_attempted_resource,
    'error',
    'not_authorized',
    'internal',
    jsonb_build_object(
      'attempted_action', p_attempted_action,
      'attempted_resource', p_attempted_resource,
      'timestamp', now(),
      'security_event', true
    )
  );
END;
$$;

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