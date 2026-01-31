-- Step 1: First check if we need to add missing columns to org_stripe_subscriptions
-- Add product_line, plan_key, and event tracking columns if they don't exist

-- Add product_line column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'org_stripe_subscriptions' 
                 AND column_name = 'product_line') THEN
    ALTER TABLE public.org_stripe_subscriptions ADD COLUMN product_line TEXT;
  END IF;
END $$;

-- Add event_id for idempotency if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'org_stripe_subscriptions' 
                 AND column_name = 'last_event_id') THEN
    ALTER TABLE public.org_stripe_subscriptions ADD COLUMN last_event_id TEXT;
  END IF;
END $$;

-- Add event_processed_at for idempotency if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'org_stripe_subscriptions' 
                 AND column_name = 'event_processed_at') THEN
    ALTER TABLE public.org_stripe_subscriptions ADD COLUMN event_processed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Step 2: Create a function to safely convert Stripe timestamps
CREATE OR REPLACE FUNCTION public.safe_stripe_timestamp(stripe_timestamp BIGINT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  -- Check for null or invalid timestamps
  IF stripe_timestamp IS NULL OR stripe_timestamp <= 0 THEN
    RETURN NULL;
  END IF;
  
  -- Convert from Unix timestamp (seconds) to timestamptz
  RETURN to_timestamp(stripe_timestamp);
EXCEPTION
  WHEN OTHERS THEN
    -- If conversion fails, return NULL instead of throwing error
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Create function to compute organization entitlements from all active subscriptions
CREATE OR REPLACE FUNCTION public.compute_org_entitlements(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{"limit_agents": 0, "limit_seats": 1, "features": [], "plan_keys": []}'::jsonb;
  sub_record RECORD;
  max_agents INTEGER := 0;
  max_seats INTEGER := 1;
  all_features TEXT[] := ARRAY[]::TEXT[];
  plan_keys TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get all active subscriptions for the org
  FOR sub_record IN 
    SELECT plan_key, quantity, status
    FROM public.org_stripe_subscriptions 
    WHERE organization_id = p_org_id 
      AND status IN ('active', 'trialing', 'past_due')
  LOOP
    -- Collect plan keys
    IF sub_record.plan_key IS NOT NULL THEN
      plan_keys := array_append(plan_keys, sub_record.plan_key);
    END IF;
    
    -- Get plan limits from plan_configs
    SELECT 
      COALESCE((limits->>'agents')::INTEGER, 0),
      COALESCE((limits->>'seats')::INTEGER, 1),
      COALESCE(features, ARRAY[]::TEXT[])
    INTO sub_record.limit_agents, sub_record.limit_seats, sub_record.features
    FROM public.plan_configs 
    WHERE plan_key = sub_record.plan_key;
    
    -- Aggregate limits (take maximum)
    max_agents := GREATEST(max_agents, COALESCE(sub_record.limit_agents, 0));
    max_seats := GREATEST(max_seats, COALESCE(sub_record.limit_seats * sub_record.quantity, 1));
    
    -- Merge features
    all_features := array_cat(all_features, COALESCE(sub_record.features, ARRAY[]::TEXT[]));
  END LOOP;
  
  -- Remove duplicates from features
  SELECT array_agg(DISTINCT feature ORDER BY feature) INTO all_features FROM unnest(all_features) feature;
  
  -- Build result
  result := jsonb_build_object(
    'limit_agents', max_agents,
    'limit_seats', max_seats, 
    'features', to_jsonb(COALESCE(all_features, ARRAY[]::TEXT[])),
    'plan_keys', to_jsonb(plan_keys)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 4: Create function to update organization summary from subscriptions
CREATE OR REPLACE FUNCTION public.refresh_organization_billing_summary(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  primary_sub RECORD;
  computed_entitlements JSONB;
  org_status TEXT := 'trialing';
  next_renewal TIMESTAMPTZ;
BEGIN
  -- Get the primary subscription (most recent active one)
  SELECT * INTO primary_sub
  FROM public.org_stripe_subscriptions 
  WHERE organization_id = p_org_id 
    AND status IN ('active', 'trialing', 'past_due')
  ORDER BY 
    CASE 
      WHEN status = 'active' THEN 1
      WHEN status = 'trialing' THEN 2  
      WHEN status = 'past_due' THEN 3
      ELSE 4
    END,
    current_period_end DESC
  LIMIT 1;
  
  -- Compute aggregated entitlements
  computed_entitlements := public.compute_org_entitlements(p_org_id);
  
  -- Determine org billing status and next renewal
  IF primary_sub.id IS NOT NULL THEN
    org_status := primary_sub.status;
    next_renewal := primary_sub.current_period_end;
  ELSE
    -- No active subscriptions
    org_status := 'inactive';
    next_renewal := NULL;
  END IF;
  
  -- Update the organizations table
  UPDATE public.organizations 
  SET 
    billing_status = org_status,
    plan_key = COALESCE(primary_sub.plan_key, 'trial'),
    entitlements = computed_entitlements,
    cancel_at_period_end = COALESCE(primary_sub.cancel_at_period_end, false),
    updated_at = now()
  WHERE id = p_org_id;
  
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to track processed webhook events (idempotency)
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID REFERENCES public.organizations(id),
  subscription_id TEXT
);

-- Enable RLS on processed_webhook_events
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only system can manage webhook events
DROP POLICY IF EXISTS "system_only_webhook_events" ON public.processed_webhook_events;
CREATE POLICY "system_only_webhook_events" ON public.processed_webhook_events
FOR ALL USING (false);
