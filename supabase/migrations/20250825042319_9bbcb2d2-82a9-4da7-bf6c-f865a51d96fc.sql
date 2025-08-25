-- Fix security linter warnings - add SET search_path to functions

-- Fix function search_path warnings by adding SET search_path to missing functions
CREATE OR REPLACE FUNCTION public.admin_change_member_role(p_organization_id uuid, p_user_id uuid, p_new_role org_role, p_admin_user_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  old_role org_role;
  org_name text;
BEGIN
  -- Verify admin has permission for this org
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_organization_id AND owner_user_id = p_admin_user_id
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_organization_id 
        AND user_id = p_admin_user_id 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get current role and org name
  SELECT om.role, o.name INTO old_role, org_name
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.organization_id = p_organization_id AND om.user_id = p_user_id;

  -- Update member role
  UPDATE public.organization_members 
  SET role = p_new_role
  WHERE organization_id = p_organization_id AND user_id = p_user_id;

  -- Log the change
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
    p_organization_id,
    p_admin_user_id,
    'admin',
    'member.role_changed',
    'member',
    p_user_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'old_role', old_role::text,
      'new_role', p_new_role::text,
      'changed_by', 'admin',
      'organization_name', org_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_role', old_role::text,
    'new_role', p_new_role::text
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_member_seat(p_organization_id uuid, p_user_id uuid, p_seat_active boolean, p_admin_user_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  old_status boolean;
  org_name text;
BEGIN
  -- Verify admin has permission for this org
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_organization_id AND owner_user_id = p_admin_user_id
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_organization_id 
        AND user_id = p_admin_user_id 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get current status and org name
  SELECT om.seat_active, o.name INTO old_status, org_name
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.organization_id = p_organization_id AND om.user_id = p_user_id;

  -- Update seat status
  UPDATE public.organization_members 
  SET seat_active = p_seat_active
  WHERE organization_id = p_organization_id AND user_id = p_user_id;

  -- Log the change
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
    p_organization_id,
    p_admin_user_id,
    'admin',
    CASE WHEN p_seat_active THEN 'member.seat_activated' ELSE 'member.seat_deactivated' END,
    'member',
    p_user_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'old_status', old_status,
      'new_status', p_seat_active,
      'changed_by', 'admin',
      'organization_name', org_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_status', old_status,
    'new_status', p_seat_active
  );
END;
$function$;