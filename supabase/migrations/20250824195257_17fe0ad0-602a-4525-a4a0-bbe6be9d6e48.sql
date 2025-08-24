-- Add suspension fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS suspension_status TEXT DEFAULT 'active' CHECK (suspension_status IN ('active', 'suspended')),
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id);

-- Create index for suspension status queries
CREATE INDEX IF NOT EXISTS idx_organizations_suspension_status ON public.organizations(suspension_status);

-- Add suspension-related columns to audit_log for better tracking
-- (These are optional since audit_log already has metadata field)

-- Create function to check if organization is suspended
CREATE OR REPLACE FUNCTION public.is_org_suspended(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT suspension_status = 'suspended'
  FROM public.organizations
  WHERE id = org_id;
$function$;

-- Create function to suspend organization
CREATE OR REPLACE FUNCTION public.suspend_organization(
  p_org_id uuid,
  p_reason text,
  p_suspended_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_name text;
  result jsonb;
BEGIN
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
      'suspended_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'suspended_at', now(),
    'reason', p_reason
  );
END;
$function$;

-- Create function to reinstate organization
CREATE OR REPLACE FUNCTION public.reinstate_organization(
  p_org_id uuid,
  p_reason text,
  p_reinstated_by uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_name text;
  result jsonb;
BEGIN
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
      'reinstated_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'reinstated_at', now(),
    'reason', p_reason
  );
END;
$function$;