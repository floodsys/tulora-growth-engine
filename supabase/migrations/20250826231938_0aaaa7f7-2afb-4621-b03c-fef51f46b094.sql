-- Drop and recreate the role function with correct signature
DROP FUNCTION IF EXISTS public.get_user_org_role(uuid, uuid);

-- Create canonical role retrieval function
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  is_owner boolean;
  member_role org_role;
  seat_active boolean;
BEGIN
  -- Check if user is organization owner
  SELECT (owner_user_id = COALESCE(p_user_id, auth.uid())) INTO is_owner
  FROM public.organizations
  WHERE id = p_org_id;

  IF is_owner THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'is_owner', true,
      'seat_active', true,
      'is_member', true
    );
  END IF;

  -- Check organization membership
  SELECT role, seat_active INTO member_role, seat_active
  FROM public.organization_members
  WHERE organization_id = p_org_id 
    AND user_id = COALESCE(p_user_id, auth.uid());

  IF member_role IS NOT NULL THEN
    RETURN jsonb_build_object(
      'role', member_role::text,
      'is_owner', false,
      'seat_active', COALESCE(seat_active, false),
      'is_member', true
    );
  END IF;

  -- Not a member
  RETURN jsonb_build_object(
    'role', null,
    'is_owner', false,
    'seat_active', false,
    'is_member', false
  );
END;
$function$;