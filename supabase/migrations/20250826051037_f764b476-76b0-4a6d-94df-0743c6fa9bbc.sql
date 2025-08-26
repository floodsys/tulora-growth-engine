-- Create or replace check_admin_access function with superadmin bypass
CREATE OR REPLACE FUNCTION public.check_admin_access(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- Check if user is organization owner
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = p_org_id AND o.owner_user_id = COALESCE(p_user_id, auth.uid())
    ) OR
    -- Check if user is admin member
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = p_org_id 
        AND om.user_id = COALESCE(p_user_id, auth.uid())
        AND om.role = 'admin'::org_role 
        AND om.seat_active = true
    ) OR
    -- Superadmin bypass - superadmins can access any organization
    public.is_superadmin(COALESCE(p_user_id, auth.uid()));
$function$

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_admin_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_access(uuid) TO authenticated;