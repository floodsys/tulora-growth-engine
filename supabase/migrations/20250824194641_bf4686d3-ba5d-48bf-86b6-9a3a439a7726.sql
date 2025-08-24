-- Create admin functions for member management with proper RLS

-- Function to change member role (admin only)
CREATE OR REPLACE FUNCTION admin_change_member_role(
  p_organization_id UUID,
  p_user_id UUID,
  p_new_role org_role,
  p_admin_user_id UUID DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Function to toggle seat activation (admin only)
CREATE OR REPLACE FUNCTION admin_toggle_member_seat(
  p_organization_id UUID,
  p_user_id UUID,
  p_seat_active BOOLEAN,
  p_admin_user_id UUID DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Function to remove member from organization (admin only)
CREATE OR REPLACE FUNCTION admin_remove_member(
  p_organization_id UUID,
  p_user_id UUID,
  p_admin_user_id UUID DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  member_role org_role;
  org_name text;
  member_email text;
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

  -- Cannot remove organization owner
  IF EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = p_organization_id AND owner_user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove organization owner');
  END IF;

  -- Get member details for logging
  SELECT om.role, o.name, p.email INTO member_role, org_name, member_email
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = p_organization_id AND om.user_id = p_user_id;

  -- Remove member
  DELETE FROM public.organization_members 
  WHERE organization_id = p_organization_id AND user_id = p_user_id;

  -- Log the removal
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
    'member.removed',
    'member',
    p_user_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'member_role', member_role::text,
      'member_email', member_email,
      'removed_by', 'admin',
      'organization_name', org_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'removed_user_id', p_user_id,
    'removed_role', member_role::text
  );
END;
$$;

-- Function to get all members across organizations (superadmin only)
CREATE OR REPLACE FUNCTION admin_get_all_members(
  p_search_email TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  seat_active BOOLEAN,
  joined_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- For now, only allow organization owners to see their own org members
  -- TODO: Add superadmin check when implemented
  
  RETURN QUERY
  SELECT 
    om.user_id,
    COALESCE(p.email, 'Unknown') as email,
    om.organization_id,
    o.name as organization_name,
    om.role::text,
    om.seat_active,
    om.created_at as joined_at,
    -- Mock last activity for now
    (now() - (random() * interval '30 days')) as last_activity
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE 
    -- Only show orgs where current user is owner/admin
    (
      o.owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.organization_members om2
        WHERE om2.organization_id = o.id 
          AND om2.user_id = auth.uid() 
          AND om2.role = 'admin'::org_role 
          AND om2.seat_active = true
      )
    )
    AND (p_search_email IS NULL OR p.email ILIKE '%' || p_search_email || '%')
  ORDER BY o.name, p.email
  LIMIT p_limit;
END;
$$;