-- Fix infinite recursion in organizations RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;

-- Recreate proper RLS policies for organizations table
-- Select policy: owners and active members can see organization
CREATE POLICY "organizations_select_policy" ON public.organizations
FOR SELECT
TO authenticated
USING (
  owner_user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organizations.id 
      AND user_id = auth.uid() 
      AND seat_active = true
  )
);

-- Update policy: only owners and admin members can update
CREATE POLICY "organizations_update_policy" ON public.organizations
FOR UPDATE
TO authenticated
USING (
  owner_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organizations.id 
      AND user_id = auth.uid() 
      AND role = 'admin'::org_role 
      AND seat_active = true
  )
)
WITH CHECK (
  owner_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organizations.id 
      AND user_id = auth.uid() 
      AND role = 'admin'::org_role 
      AND seat_active = true
  )
);

-- Insert policy: any authenticated user can create organizations
CREATE POLICY "organizations_insert_policy" ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Delete policy: only owners can delete organizations
CREATE POLICY "organizations_delete_policy" ON public.organizations
FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());