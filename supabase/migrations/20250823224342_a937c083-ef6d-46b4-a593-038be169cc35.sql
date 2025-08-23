-- Fix critical security issues from the normalization migration

-- Re-enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Update function with proper search path (addresses function search path mutable warning)
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        AND role = 'admin'::public.org_role 
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$function$;

-- Update is_org_member function with proper search path
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Recreate essential RLS policies with proper enum handling
CREATE POLICY "organizations_select_policy" ON public.organizations
FOR SELECT USING (
    (owner_user_id = auth.uid()) OR 
    (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = organizations.id 
        AND user_id = auth.uid() 
        AND seat_active = true
    ))
);

CREATE POLICY "organizations_insert_policy" ON public.organizations
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "organizations_update_policy" ON public.organizations
FOR UPDATE USING (
    (owner_user_id = auth.uid()) OR 
    (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = organizations.id 
        AND user_id = auth.uid() 
        AND role = 'admin'::public.org_role 
        AND seat_active = true
    ))
);

-- Organization members policies
CREATE POLICY "organization_members_select_policy" ON public.organization_members
FOR SELECT USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    )) OR 
    (user_id = auth.uid()) OR
    (EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_members.organization_id 
        AND om.user_id = auth.uid() 
        AND om.seat_active = true
    ))
);

CREATE POLICY "organization_members_insert_policy" ON public.organization_members
FOR INSERT WITH CHECK (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    )) OR 
    (user_id = auth.uid())
);

CREATE POLICY "organization_members_update_policy" ON public.organization_members
FOR UPDATE USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    )) OR 
    (user_id = auth.uid())
);

CREATE POLICY "organization_members_delete_policy" ON public.organization_members
FOR DELETE USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_members.organization_id 
        AND owner_user_id = auth.uid()
    ))
);

-- Organization invitations policies
CREATE POLICY "organization_invitations_select_policy" ON public.organization_invitations
FOR SELECT USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    )) OR
    (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::public.org_role
        AND seat_active = true
    ))
);

CREATE POLICY "organization_invitations_insert_policy" ON public.organization_invitations
FOR INSERT WITH CHECK (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    )) OR
    (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::public.org_role
        AND seat_active = true
    ))
);

CREATE POLICY "organization_invitations_update_policy" ON public.organization_invitations
FOR UPDATE USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    )) OR
    (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::public.org_role
        AND seat_active = true
    ))
);

CREATE POLICY "organization_invitations_delete_policy" ON public.organization_invitations
FOR DELETE USING (
    (EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    )) OR
    (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::public.org_role
        AND seat_active = true
    ))
);