-- Enable RLS on all organization tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to make this idempotent
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
DROP POLICY IF EXISTS "organization_members_select_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete_policy" ON public.organization_members;
DROP POLICY IF EXISTS "organization_invitations_select_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_insert_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_update_policy" ON public.organization_invitations;
DROP POLICY IF EXISTS "organization_invitations_delete_policy" ON public.organization_invitations;

-- ORGANIZATIONS POLICIES
-- SELECT: allowed if current user is the owner or is a member of that org
CREATE POLICY "organizations_select_policy" ON public.organizations
    FOR SELECT USING (
        -- Check if user is the owner
        owner_user_id = auth.uid() 
        OR 
        -- Check if user is any member of the organization
        EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid() 
            AND seat_active = true
        )
    );

-- UPDATE: allowed only if is_org_admin(org_id)
CREATE POLICY "organizations_update_policy" ON public.organizations
    FOR UPDATE USING (
        -- Check if user is the owner
        owner_user_id = auth.uid() 
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid() 
            AND role::text = 'admin'
            AND seat_active = true
        )
    );

-- INSERT: allow authenticated users to create organizations
CREATE POLICY "organizations_insert_policy" ON public.organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ORGANIZATION_MEMBERS POLICIES
-- SELECT: allowed to any member of the same organization_id
CREATE POLICY "organization_members_select_policy" ON public.organization_members
    FOR SELECT USING (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_members.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is any member of the organization
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_members.organization_id 
            AND om.user_id = auth.uid() 
            AND om.seat_active = true
        )
    );

-- INSERT: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_members_insert_policy" ON public.organization_members
    FOR INSERT WITH CHECK (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_members.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_members.organization_id 
            AND om.user_id = auth.uid() 
            AND om.role::text = 'admin'
            AND om.seat_active = true
        )
    );

-- UPDATE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_members_update_policy" ON public.organization_members
    FOR UPDATE USING (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_members.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_members.organization_id 
            AND om.user_id = auth.uid() 
            AND om.role::text = 'admin'
            AND om.seat_active = true
        )
    );

-- DELETE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_members_delete_policy" ON public.organization_members
    FOR DELETE USING (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_members.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_members.organization_id 
            AND om.user_id = auth.uid() 
            AND om.role::text = 'admin'
            AND om.seat_active = true
        )
    );

-- ORGANIZATION_INVITATIONS POLICIES
-- SELECT: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_select_policy" ON public.organization_invitations
    FOR SELECT USING (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_invitations.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_invitations.organization_id 
            AND om.user_id = auth.uid() 
            AND om.role::text = 'admin'
            AND om.seat_active = true
        )
    );

-- INSERT: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_insert_policy" ON public.organization_invitations
    FOR INSERT WITH CHECK (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_invitations.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_invitations.organization_id 
            AND om.user_id = auth.uid() 
            AND om.role::text = 'admin'
            AND om.seat_active = true
        )
    );

-- UPDATE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_update_policy" ON public.organization_invitations
    FOR UPDATE USING (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_invitations.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_invitations.organization_id 
            AND om.user_id = auth.uid() 
            AND om.role::text = 'admin'
            AND om.seat_active = true
        )
    );

-- DELETE: allowed only if is_org_admin(organization_id)
CREATE POLICY "organization_invitations_delete_policy" ON public.organization_invitations
    FOR DELETE USING (
        -- Check if user is the owner of the organization
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = organization_invitations.organization_id 
            AND owner_user_id = auth.uid()
        )
        OR 
        -- Check if user is an admin member
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = organization_invitations.organization_id 
            AND om.user_id = auth.uid() 
            AND om.role::text = 'admin'
            AND om.seat_active = true
        )
    );