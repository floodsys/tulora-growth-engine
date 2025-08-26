-- Subscriptions Table Consolidation Migration
-- Canonicalize on org_stripe_subscriptions and create compatibility view

-- 1. First, ensure the canonical table has proper uniqueness constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'org_stripe_subscriptions_stripe_subscription_id_unique'
    ) THEN
        ALTER TABLE public.org_stripe_subscriptions 
        ADD CONSTRAINT org_stripe_subscriptions_stripe_subscription_id_unique 
        UNIQUE (stripe_subscription_id);
    END IF;
END $$;

-- 2. Migrate data from org_subscriptions to org_stripe_subscriptions where not already present
INSERT INTO public.org_stripe_subscriptions (
  organization_id,
  stripe_subscription_id,
  stripe_customer_id,
  plan_key,
  status,
  quantity,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  trial_end,
  created_at,
  updated_at
)
SELECT 
  os.org_id as organization_id,
  os.stripe_subscription_id,
  NULL as stripe_customer_id, -- Will need to be populated later if needed
  NULL as plan_key, -- Will need to be populated later if needed
  os.status,
  os.quantity,
  os.current_period_start,
  os.current_period_end,
  os.cancel_at_period_end,
  os.trial_end,
  os.created_at,
  os.updated_at
FROM public.org_subscriptions os
WHERE os.stripe_subscription_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.org_stripe_subscriptions oss
    WHERE oss.stripe_subscription_id = os.stripe_subscription_id
  );

-- 3. Drop the old table
DROP TABLE IF EXISTS public.org_subscriptions CASCADE;

-- 4. Create a compatibility view with the old table name and column mappings
CREATE VIEW public.org_subscriptions AS
SELECT
  id,
  organization_id as org_id,
  stripe_subscription_id,
  NULL as product_id, -- Legacy column, not in canonical table
  NULL as price_id, -- Legacy column, not in canonical table
  NULL as subscription_item_id, -- Legacy column, not in canonical table
  status,
  quantity,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  trial_end,
  created_at,
  updated_at
FROM public.org_stripe_subscriptions;