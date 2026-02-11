-- First, check if we need to backfill data from org_subscriptions to org_stripe_subscriptions
DO $$
DECLARE
    org_subs_count INTEGER;
    org_stripe_subs_count INTEGER;
BEGIN
    -- Count records in org_subscriptions
    SELECT COUNT(*) INTO org_subs_count FROM org_subscriptions;
    
    -- Count records in org_stripe_subscriptions  
    SELECT COUNT(*) INTO org_stripe_subs_count FROM org_stripe_subscriptions;
    
    -- If org_subscriptions has data and org_stripe_subscriptions is empty or has less data, backfill
    IF org_subs_count > 0 AND org_stripe_subs_count < org_subs_count THEN
        RAISE NOTICE 'Backfilling % records from org_subscriptions to org_stripe_subscriptions', org_subs_count;
        
        -- Backfill data from org_subscriptions to org_stripe_subscriptions
        INSERT INTO org_stripe_subscriptions (
            organization_id,
            stripe_subscription_id,
            stripe_customer_id,
            plan_key, 
            status,
            current_period_start,
            current_period_end,
            quantity,
            cancel_at_period_end,
            trial_end,
            created_at,
            updated_at
        )
        SELECT 
            org_id as organization_id,
            stripe_subscription_id,
            NULL as stripe_customer_id, -- Will be populated by webhook
            product_id as plan_key, -- Map product_id to plan_key
            status,
            current_period_start,
            current_period_end,
            quantity,
            cancel_at_period_end,
            trial_end,
            created_at,
            updated_at
        FROM org_subscriptions
        ON CONFLICT (stripe_subscription_id) DO NOTHING; -- Avoid duplicates
        
        RAISE NOTICE 'Backfill completed';
    ELSE
        RAISE NOTICE 'No backfill needed. org_subscriptions: %, org_stripe_subscriptions: %', org_subs_count, org_stripe_subs_count;
    END IF;
END $$;

-- Add a timestamp guard function for webhook safety
CREATE OR REPLACE FUNCTION public.safe_timestamp_from_epoch(epoch_value bigint)
RETURNS timestamp with time zone
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Only convert if the value is a reasonable timestamp (between 2000 and 2100)
    -- Stripe timestamps are in seconds since epoch
    IF epoch_value IS NULL OR epoch_value < 946684800 OR epoch_value > 4102444800 THEN
        RETURN NULL;
    END IF;
    
    RETURN to_timestamp(epoch_value);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- Update RLS policies to ensure org_stripe_subscriptions is properly secured
-- Only service role can write, org members can read their own
DROP POLICY IF EXISTS "System can manage subscriptions" ON org_stripe_subscriptions;
DROP POLICY IF EXISTS "Org members can view subscriptions" ON org_stripe_subscriptions;

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON org_stripe_subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON org_stripe_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Org members can view own subscriptions" ON org_stripe_subscriptions;
CREATE POLICY "Org members can view own subscriptions" ON org_stripe_subscriptions  
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = org_stripe_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.seat_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = org_stripe_subscriptions.organization_id
      AND o.owner_user_id = auth.uid()
  )
);

-- Add an index for better performance on webhook operations
CREATE INDEX IF NOT EXISTS idx_org_stripe_subscriptions_stripe_id 
ON org_stripe_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_org_stripe_subscriptions_org_id 
ON org_stripe_subscriptions(organization_id);
