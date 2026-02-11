-- Subscriptions Table Consolidation Migration (idempotent v3)
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

-- 2. Migrate data from org_subscriptions TABLE (not VIEW) to org_stripe_subscriptions
-- Skip if org_subscriptions is already a view or doesn't exist as a table
DO $$
BEGIN
    -- Only migrate if org_subscriptions is a TABLE (not a VIEW)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'org_subscriptions' 
          AND table_type = 'BASE TABLE'
    ) THEN
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
            NULL as stripe_customer_id,
            NULL as plan_key,
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
        RAISE NOTICE 'Migrated data from org_subscriptions table';
    ELSE
        RAISE NOTICE 'Skipping data migration: org_subscriptions is not a table (may already be a view)';
    END IF;
END $$;

-- 3. Drop the old table OR view (handle both cases)
DROP VIEW IF EXISTS public.org_subscriptions CASCADE;
DROP TABLE IF EXISTS public.org_subscriptions CASCADE;

-- 4. Create a compatibility view with the old table name and column mappings
CREATE OR REPLACE VIEW public.org_subscriptions AS
SELECT
  id,
  organization_id as org_id,
  stripe_subscription_id,
  NULL::text as product_id,
  NULL::text as price_id,
  NULL::text as subscription_item_id,
  status,
  quantity,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  trial_end,
  created_at,
  updated_at
FROM public.org_stripe_subscriptions;

-- 5. Log the consolidation (only if at least one organization exists)
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        INSERT INTO public.audit_log (
            organization_id,
            actor_user_id,
            actor_role_snapshot,
            action,
            target_type,
            target_id,
            status,
            channel,
            metadata
        ) VALUES (
            v_org_id,
            NULL,
            'system',
            'subscriptions.consolidated',
            'other',
            'org_stripe_subscriptions',
            'success',
            'internal',
            jsonb_build_object(
                'canonical_table', 'org_stripe_subscriptions',
                'legacy_table_replaced', 'org_subscriptions',
                'view_created', 'org_subscriptions (compatibility)',
                'uniqueness_constraint', 'stripe_subscription_id',
                'timestamp', now()
            )
        );
        RAISE NOTICE 'Subscription consolidation v3 logged for org_id: %', v_org_id;
    ELSE
        RAISE NOTICE 'Skipping consolidation log: no organizations exist yet';
    END IF;
END $$;
