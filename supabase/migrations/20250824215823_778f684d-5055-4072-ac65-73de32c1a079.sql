-- Fix search_path warnings by explicitly setting search_path for security definer functions
-- The is_org_active function was already created with proper search_path, 
-- but let's ensure other security definer functions also have it set

-- Update is_org_owner function to have explicit search_path
CREATE OR REPLACE FUNCTION public.is_org_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$function$;

-- Update is_org_member function to have explicit search_path
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
      AND user_id = auth.uid() 
      AND seat_active = true
  );
$function$;

-- Update is_org_admin function to have explicit search_path if it exists
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = org_id AND owner_user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role
        AND seat_active = true
    )
  );
$function$;