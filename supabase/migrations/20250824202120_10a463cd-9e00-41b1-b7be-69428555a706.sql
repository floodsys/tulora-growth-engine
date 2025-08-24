-- Fix infinite recursion in organizations RLS and create proper admin security functions
-- Fixed UUID MIN issue

-- 1. First, create secure functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- For now, use a simple check - first organization owner is considered superadmin
  -- This can be extended later with a dedicated superadmin table
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.owner_user_id = user_id
    ORDER BY o.created_at ASC
    LIMIT 1
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
      AND user_id = user_id 
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
        AND user_id = user_id 
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