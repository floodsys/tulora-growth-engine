-- Fix infinite recursion in organization_members RLS policies
-- The issue is likely in the SELECT policy that references organization_members within itself

-- Drop the problematic policy
DROP POLICY IF EXISTS "organization_members_select_policy" ON organization_members;

-- Create a security definer function for membership checks
CREATE OR REPLACE FUNCTION public.check_org_member_access(target_org_id uuid, target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- User can see their own membership
  IF target_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Organization owner can see all members
  IF EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = target_org_id AND owner_user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Active members can see other members in same org
  IF EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = target_org_id 
    AND user_id = auth.uid() 
    AND seat_active = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate the policy using the security definer function
CREATE POLICY "organization_members_select_policy" ON organization_members
FOR SELECT USING (check_org_member_access(organization_id, user_id));