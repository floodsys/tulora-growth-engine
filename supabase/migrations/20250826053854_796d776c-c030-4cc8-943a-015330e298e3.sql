-- Ensure org_role enum includes admin and update user membership
-- First, check and update the enum if needed
DO $$ 
BEGIN
    -- Add admin to org_role enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = 'org_role'::regtype) THEN
        ALTER TYPE public.org_role ADD VALUE 'admin';
    END IF;
END $$;

-- Create function to make current user admin of an organization (enum-safe)
CREATE OR REPLACE FUNCTION public.make_user_org_admin(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  membership_result jsonb;
BEGIN
  current_user_id := COALESCE(p_user_id, auth.uid());
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify the organization exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RETURN jsonb_build_object('error', 'Organization not found');
  END IF;

  -- Upsert membership with admin role and active seat
  INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
  VALUES (p_org_id, current_user_id, 'admin'::org_role, true)
  ON CONFLICT (organization_id, user_id) 
  DO UPDATE SET 
    role = 'admin'::org_role,
    seat_active = true;

  -- Get the updated membership info
  SELECT jsonb_build_object(
    'user_id', current_user_id,
    'organization_id', p_org_id,
    'role', om.role::text,
    'seat_active', om.seat_active,
    'created_at', om.created_at,
    'success', true
  ) INTO membership_result
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id AND om.user_id = current_user_id;

  -- Log the admin role assignment
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
    current_user_id,
    'admin',
    'membership.admin_assigned',
    'membership',
    current_user_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'role_assigned', 'admin',
      'seat_active', true,
      'self_assignment', true,
      'timestamp', now()
    )
  );

  RETURN COALESCE(membership_result, jsonb_build_object('error', 'Failed to update membership'));
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.make_user_org_admin(uuid, uuid) TO authenticated;