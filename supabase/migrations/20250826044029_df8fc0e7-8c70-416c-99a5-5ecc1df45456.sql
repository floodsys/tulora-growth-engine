-- Quick unblock: Add direct superadmin policy for organizations UPDATE
-- This allows superadmins to update any organization directly

CREATE POLICY "superadmin_can_update_organizations" 
ON public.organizations 
FOR UPDATE
TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- Also add SELECT policy for superadmins (for completeness)
CREATE POLICY "superadmin_can_select_organizations" 
ON public.organizations 
FOR SELECT
TO authenticated
USING (public.is_superadmin());