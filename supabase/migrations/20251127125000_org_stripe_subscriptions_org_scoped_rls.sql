-- Migration: Org-scoped RLS for org_stripe_subscriptions
-- This migration replaces overly permissive RLS policies with proper org-scoped policies.

-- ============================================================================
-- Step 1: Drop existing overly permissive policies
-- ============================================================================

-- Drop the tautology policy that allows anyone to do anything
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.org_stripe_subscriptions;

-- Drop the redundant SELECT policy (we'll replace it with a properly named one)
DROP POLICY IF EXISTS "Org members can view own subscriptions" ON public.org_stripe_subscriptions;

-- Drop any legacy policies that might still exist
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.org_stripe_subscriptions;
DROP POLICY IF EXISTS "Org members can view subscriptions" ON public.org_stripe_subscriptions;

-- ============================================================================
-- Step 2: Ensure RLS is enabled
-- ============================================================================

ALTER TABLE public.org_stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 3: Create org-scoped policies
-- ============================================================================

-- SELECT: Org members can view their organization's subscriptions
CREATE POLICY "org_subs_select_org_member"
ON public.org_stripe_subscriptions
FOR SELECT
USING (is_org_member(organization_id));

-- INSERT: Only org admins can insert subscriptions for their organization
CREATE POLICY "org_subs_insert_org_admin"
ON public.org_stripe_subscriptions
FOR INSERT
WITH CHECK (is_org_admin(organization_id));

-- UPDATE: Only org admins can update their organization's subscriptions
CREATE POLICY "org_subs_update_org_admin"
ON public.org_stripe_subscriptions
FOR UPDATE
USING (is_org_admin(organization_id))
WITH CHECK (is_org_admin(organization_id));

-- DELETE: Only org admins can delete their organization's subscriptions
CREATE POLICY "org_subs_delete_org_admin"
ON public.org_stripe_subscriptions
FOR DELETE
USING (is_org_admin(organization_id));

-- ============================================================================
-- Documentation Comment
-- ============================================================================

COMMENT ON TABLE public.org_stripe_subscriptions IS 
'Stripe subscription sync data. 
RLS Policy Summary (as of this migration):
- SELECT: Org members can view their organization''s subscription rows (org_subs_select_org_member)
- INSERT/UPDATE/DELETE: Only org admins can write subscription rows (org_subs_write policies)
Subscription rows are now only visible to org members and only writable by org admins.';

-- ============================================================================
-- Final Policy SQL Summary
-- ============================================================================
/*
Policies created:

1. org_subs_select_org_member (SELECT)
   - USING: is_org_member(organization_id)
   - Allows any org member to view subscriptions for their organization

2. org_subs_insert_org_admin (INSERT)
   - WITH CHECK: is_org_admin(organization_id)
   - Only org admins can insert new subscription rows

3. org_subs_update_org_admin (UPDATE)
   - USING: is_org_admin(organization_id)
   - WITH CHECK: is_org_admin(organization_id)
   - Only org admins can update existing subscription rows

4. org_subs_delete_org_admin (DELETE)
   - USING: is_org_admin(organization_id)
   - Only org admins can delete subscription rows

Note: Service role (used by Edge Functions/webhooks) bypasses RLS entirely,
so Stripe webhook handlers will continue to work without issues.
*/
