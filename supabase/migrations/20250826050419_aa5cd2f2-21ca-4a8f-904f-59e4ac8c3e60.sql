-- Fix organization_members SELECT policies to use existing function
-- Drop existing policies that reference the missing function
DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select_policy_minimal" ON public.organization_members;

-- Create new SELECT policy using the existing check_org_membership function
CREATE POLICY "organization_members_select_policy_fixed" 
ON public.organization_members 
FOR SELECT 
USING (check_org_membership(organization_id, user_id));