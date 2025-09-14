-- Create missing admin RPC functions for member management

-- Function to get all members with organization details
CREATE OR REPLACE FUNCTION public.admin_get_all_members(p_search_email text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, email text, organization_id uuid, organization_name text, role text, seat_active boolean, joined_at timestamp with time zone, last_activity timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user is superadmin
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: superadmin required';
  END IF;
  
  RETURN QUERY
  SELECT 
    om.user_id,
    COALESCE(p.email, au.email, 'Unknown') as email,
    om.organization_id,
    o.name as organization_name,
    om.role::text,
    om.seat_active,
    om.created_at as joined_at,
    -- Mock last activity for now - could be enhanced with actual activity tracking
    (now() - (random() * interval '30 days')) as last_activity
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  LEFT JOIN public.profiles p ON p.user_id = om.user_id
  LEFT JOIN auth.users au ON au.id = om.user_id
  WHERE 
    (p_search_email IS NULL OR 
     COALESCE(p.email, au.email, '') ILIKE '%' || p_search_email || '%')
  ORDER BY o.name, COALESCE(p.email, au.email, '')
  LIMIT p_limit;
END;
$function$;

-- Function to change member role
CREATE OR REPLACE FUNCTION public.admin_change_member_role(p_organization_id uuid, p_user_id uuid, p_new_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_role text;
  normalized_role text;
BEGIN
  -- Verify user is superadmin
  IF NOT public.is_superadmin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: superadmin required');
  END IF;

  -- Normalize and validate role
  normalized_role := public.normalize_role_value(p_new_role);
  
  -- Get current role
  SELECT role::text INTO old_role
  FROM public.organization_members
  WHERE organization_id = p_organization_id AND user_id = p_user_id;
  
  IF old_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;
  
  -- Update role
  UPDATE public.organization_members
  SET role = normalized_role::org_role
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
    auth.uid(),
    'superadmin',
    'member.role_changed',
    'member',
    p_user_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'old_role', old_role,
      'new_role', normalized_role,
      'changed_by', 'superadmin'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'old_role', old_role,
    'new_role', normalized_role
  );
END;
$function$;

-- Function to toggle member seat status
CREATE OR REPLACE FUNCTION public.admin_toggle_member_seat(p_organization_id uuid, p_user_id uuid, p_seat_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_status boolean;
  member_email text;
BEGIN
  -- Verify user is superadmin
  IF NOT public.is_superadmin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: superadmin required');
  END IF;
  
  -- Get current status and email
  SELECT om.seat_active, COALESCE(p.email, 'Unknown')
  INTO old_status, member_email
  FROM public.organization_members om
  LEFT JOIN public.profiles p ON p.user_id = om.user_id
  WHERE om.organization_id = p_organization_id AND om.user_id = p_user_id;
  
  IF old_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;
  
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
    auth.uid(),
    'superadmin',
    'member.seat_toggled',
    'member',
    p_user_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'old_status', old_status,
      'new_status', p_seat_active,
      'member_email', member_email,
      'changed_by', 'superadmin'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'old_status', old_status,
    'new_status', p_seat_active
  );
END;
$function$;