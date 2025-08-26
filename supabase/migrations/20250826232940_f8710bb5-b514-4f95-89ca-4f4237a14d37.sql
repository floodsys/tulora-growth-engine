-- Fix Security Issue: Remove SECURITY DEFINER from org_subscriptions view
-- Replace with a standard view

DROP VIEW IF EXISTS public.org_subscriptions;

-- Create a standard view (without SECURITY DEFINER) that inherits RLS from the underlying table
CREATE VIEW public.org_subscriptions AS
SELECT
  id,
  organization_id as org_id,
  stripe_subscription_id,
  NULL::text as product_id, -- Legacy column, not in canonical table
  NULL::text as price_id, -- Legacy column, not in canonical table  
  NULL::text as subscription_item_id, -- Legacy column, not in canonical table
  status,
  quantity,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  trial_end,
  created_at,
  updated_at
FROM public.org_stripe_subscriptions;