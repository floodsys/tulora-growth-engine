-- Add canceled status support to organization status system
-- This extends the existing suspension system to include cancellation

-- Add canceled_at field to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone;

-- Update existing suspension_status to support 'canceled' in addition to 'active' and 'suspended'
-- Note: We're not using ENUM constraints here to allow flexibility

-- Update the suspension check function to include canceled status
CREATE OR REPLACE FUNCTION public.is_org_suspended_or_canceled(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT suspension_status IN ('suspended', 'canceled')
  FROM public.organizations
  WHERE id = org_id;
$function$;

-- Update organization status control functions to handle canceled state
CREATE OR REPLACE FUNCTION public.cancel_organization(p_org_id uuid, p_reason text, p_canceled_by uuid DEFAULT auth.uid())
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
      'canceled_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'canceled_at', now(),
    'reason', p_reason
  );
END;
$function$;