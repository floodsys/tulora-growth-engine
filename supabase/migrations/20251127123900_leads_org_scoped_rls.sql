-- Make public.leads RLS org-scoped instead of "any authenticated user"
-- Drop overly broad policies
DROP POLICY IF EXISTS "leads_insert_anyone" ON public.leads;
DROP POLICY IF EXISTS "leads_select_own_or_org" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_select_own" ON public.leads;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- SELECT: allowed if organization_id IS NULL OR is_org_member(organization_id)
-- This allows viewing leads that are not org-bound (contact form submissions) 
-- or leads belonging to the user's organization
DROP POLICY IF EXISTS "leads_select_org_scoped" ON public.leads;
CREATE POLICY "leads_select_org_scoped" ON public.leads
FOR SELECT
USING (
  organization_id IS NULL 
  OR is_org_member(organization_id)
);

-- INSERT: allowed if organization_id IS NULL OR is_org_member(organization_id)
-- Anonymous contact form submissions can insert leads with NULL organization_id
-- Authenticated users can insert leads into their own organizations
DROP POLICY IF EXISTS "leads_insert_org_scoped" ON public.leads;
CREATE POLICY "leads_insert_org_scoped" ON public.leads
FOR INSERT
WITH CHECK (
  organization_id IS NULL 
  OR is_org_member(organization_id)
);

-- UPDATE: allowed only if is_org_member(organization_id)
-- Only org members can update leads belonging to their organization
-- Leads with NULL organization_id cannot be updated through this policy
DROP POLICY IF EXISTS "leads_update_org_scoped" ON public.leads;
CREATE POLICY "leads_update_org_scoped" ON public.leads
FOR UPDATE
USING (
  organization_id IS NOT NULL 
  AND is_org_member(organization_id)
)
WITH CHECK (
  organization_id IS NOT NULL 
  AND is_org_member(organization_id)
);

-- DELETE: allowed only if is_org_member(organization_id)
-- Only org members can delete leads belonging to their organization
DROP POLICY IF EXISTS "leads_delete_org_scoped" ON public.leads;
CREATE POLICY "leads_delete_org_scoped" ON public.leads
FOR DELETE
USING (
  organization_id IS NOT NULL 
  AND is_org_member(organization_id)
);
