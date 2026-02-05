-- Fix remaining functions that need explicit search_path settings
-- This addresses the remaining function search path mutable warnings

-- Update log_unauthorized_access function
CREATE OR REPLACE FUNCTION public.log_unauthorized_access(p_attempted_action text, p_attempted_resource text, p_user_id uuid DEFAULT auth.uid(), p_org_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Update check_org_ownership function
CREATE OR REPLACE FUNCTION public.check_org_ownership(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND owner_user_id = user_id
  );
$function$;

-- Update check_org_membership function  
CREATE OR REPLACE FUNCTION public.check_org_membership(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
      AND organization_members.user_id = check_org_membership.user_id 
      AND seat_active = true
  );
$function$;

-- Update check_admin_access function
CREATE OR REPLACE FUNCTION public.check_admin_access(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Update has_org_role function
CREATE OR REPLACE FUNCTION public.has_org_role(org_id uuid, required_role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Check if user has the specified role in organization
  SELECT CASE 
    WHEN required_role = 'admin' AND EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id 
        AND owner_user_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND role::text = required_role
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$function$;