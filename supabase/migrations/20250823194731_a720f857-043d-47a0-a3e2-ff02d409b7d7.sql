-- Create function to check if user is organization owner
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
      AND role = 'owner'
      AND status = 'active'
  );
$function$