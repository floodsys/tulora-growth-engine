-- Fix the remaining functions with parameter shadowing issues

-- Fix is_organization_owner function
DROP FUNCTION IF EXISTS public.is_organization_owner(uuid, uuid);

CREATE OR REPLACE FUNCTION public.is_organization_owner(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org_id AND o.owner_user_id = COALESCE(p_user_id, auth.uid())
  );
$$;

ALTER FUNCTION public.is_organization_owner(uuid, uuid) OWNER TO postgres;

-- The would_leave_org_without_admins function already uses proper parameter names (user_id_to_remove and org_id)
-- but let's make it consistent with our p_ prefix pattern

DROP FUNCTION IF EXISTS public.would_leave_org_without_admins(uuid, uuid);

CREATE OR REPLACE FUNCTION public.would_leave_org_without_admins(p_org_id uuid, p_user_id_to_remove uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_count integer;
  is_owner boolean;
BEGIN
  -- Check if the user being removed is the owner (owner counts as admin)
  SELECT (o.owner_user_id = p_user_id_to_remove) INTO is_owner
  FROM public.organizations o
  WHERE o.id = p_org_id;
  
  -- Count remaining admins (excluding the user being removed)
  SELECT COUNT(*) INTO admin_count
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id 
    AND om.role::text = 'admin'
    AND om.seat_active = true 
    AND om.user_id != p_user_id_to_remove;
  
  -- If removing owner, they count as losing an admin
  -- If removing a regular admin, check if any admins remain (plus owner)
  IF is_owner THEN
    RETURN admin_count = 0; -- Would leave with no admins (owner being removed)
  ELSE
    RETURN (admin_count = 0 AND NOT EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org_id AND o.owner_user_id IS NOT NULL
    ));
  END IF;
END;
$$;

ALTER FUNCTION public.would_leave_org_without_admins(uuid, uuid) OWNER TO postgres;