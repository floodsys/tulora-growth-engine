-- Enable RLS on the tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might cause conflicts
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON public.organizations;

DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON public.organization_members;

DROP POLICY IF EXISTS "organization_invitations_select_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_insert_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_update_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_delete_policy" ON public.organization_invitations;

-- Create or replace the is_org_admin helper function
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user is organization owner OR admin member
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id 
        AND owner_user_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND role::text = 'admin'
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$$;

-- Create or replace the is_org_member helper function
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user is organization owner OR active member
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id 
        AND owner_user_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$$;

-- Organizations policies
CREATE POLICY "organizations_select_policy" 
ON public.organizations 
FOR SELECT 
USING (
  owner_user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organizations.id 
      AND user_id = auth.uid() 
      AND seat_active = true
  )
);

CREATE POLICY "organizations_insert_policy" 
ON public.organizations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "organizations_update_policy" 
ON public.organizations 
FOR UPDATE 
USING (
  owner_user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organizations.id 
      AND user_id = auth.uid() 
      AND role = 'admin'::public.org_role 
      AND seat_active = true
  )
);

-- Organization members policies
CREATE POLICY "organization_members_select_policy" 
ON public.organization_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_members.organization_id 
      AND owner_user_id = auth.uid()
  ) OR 
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_members.organization_id 
      AND om.user_id = auth.uid() 
      AND om.seat_active = true
  )
);

CREATE POLICY "organization_members_insert_policy" 
ON public.organization_members 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_members.organization_id 
      AND owner_user_id = auth.uid()
  ) OR 
  user_id = auth.uid()
);

CREATE POLICY "organization_members_update_policy" 
ON public.organization_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_members.organization_id 
      AND owner_user_id = auth.uid()
  ) OR 
  user_id = auth.uid()
);

CREATE POLICY "organization_members_delete_policy" 
ON public.organization_members 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_members.organization_id 
      AND owner_user_id = auth.uid()
  )
);

-- Organization invitations policies
CREATE POLICY "organization_invitations_select_policy" 
ON public.organization_invitations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_invitations.organization_id 
      AND owner_user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organization_invitations.organization_id 
      AND user_id = auth.uid() 
      AND role = 'admin'::public.org_role 
      AND seat_active = true
  )
);

CREATE POLICY "organization_invitations_insert_policy" 
ON public.organization_invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_invitations.organization_id 
      AND owner_user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organization_invitations.organization_id 
      AND user_id = auth.uid() 
      AND role = 'admin'::public.org_role 
      AND seat_active = true
  )
);

CREATE POLICY "organization_invitations_update_policy" 
ON public.organization_invitations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_invitations.organization_id 
      AND owner_user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organization_invitations.organization_id 
      AND user_id = auth.uid() 
      AND role = 'admin'::public.org_role 
      AND seat_active = true
  )
);

CREATE POLICY "organization_invitations_delete_policy" 
ON public.organization_invitations 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = organization_invitations.organization_id 
      AND owner_user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = organization_invitations.organization_id 
      AND user_id = auth.uid() 
      AND role = 'admin'::public.org_role 
      AND seat_active = true
  )
);