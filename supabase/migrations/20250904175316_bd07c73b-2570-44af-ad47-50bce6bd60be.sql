-- ADDITIONAL SECURITY FIX: Ensure no public access to organization_members
-- Add explicit deny policies for unauthenticated users

-- Drop existing policies to recreate with stricter controls
DROP POLICY IF EXISTS "Members can view own records and admins can view all" ON public.organization_members;
DROP POLICY IF EXISTS "Only org owners can add members" ON public.organization_members;
DROP POLICY IF EXISTS "Only org owners can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Only org owners can remove members" ON public.organization_members;

-- Create restrictive policies that explicitly require authentication
-- Only authenticated users can SELECT their own membership records or if they own the org
CREATE POLICY "Authenticated users can view own membership"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id AND owner_user_id = auth.uid()
    )
  )
);

-- Only authenticated org owners can INSERT new members
CREATE POLICY "Authenticated org owners can add members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND owner_user_id = auth.uid()
  )
);

-- Only authenticated org owners can UPDATE member records
CREATE POLICY "Authenticated org owners can update members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND owner_user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND owner_user_id = auth.uid()
  )
);

-- Only authenticated org owners can DELETE member records
CREATE POLICY "Authenticated org owners can remove members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND owner_user_id = auth.uid()
  )
);

-- Add explicit deny policy for unauthenticated users (anon role)
CREATE POLICY "Deny all access to unauthenticated users"
ON public.organization_members
FOR ALL
TO anon
USING (false)
WITH CHECK (false);