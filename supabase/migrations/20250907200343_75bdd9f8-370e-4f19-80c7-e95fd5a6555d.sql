-- Create the main entitlements aggregator RPC function
CREATE OR REPLACE FUNCTION public.get_org_entitlements(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  sub_record RECORD;
  plan_record RECORD;
  product_entitlements JSONB;
BEGIN
  -- Get all active subscriptions for the org
  FOR sub_record IN 
    SELECT 
      stripe_subscription_id,
      plan_key, 
      product_line,
      status,
      quantity,
      current_period_end
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
  LOOP
    -- Get plan configuration for this subscription
    SELECT 
      plan_key,
      display_name,
      product_line,
      limits,
      features
    INTO plan_record
    FROM public.plan_configs 
    WHERE plan_key = sub_record.plan_key
      AND is_active = true;
    
    -- Skip if plan not found or inactive
    IF plan_record.plan_key IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Build entitlements for this product line
    product_entitlements := jsonb_build_object(
      'plan_key', plan_record.plan_key,
      'plan_name', plan_record.display_name,
      'status', sub_record.status,
      'quantity', sub_record.quantity,
      'current_period_end', sub_record.current_period_end,
      'features', COALESCE(plan_record.features, ARRAY[]::TEXT[]),
      'limits', COALESCE(plan_record.limits, '{}'::jsonb)
    );
    
    -- Add/update this product line in the result
    -- If multiple subs for same product line, take the highest tier
    IF result ? plan_record.product_line THEN
      -- Compare plans and keep the better one (business > starter > trial)
      IF plan_record.plan_key LIKE '%business%' OR 
         (result->plan_record.product_line->>'plan_key' NOT LIKE '%business%' AND 
          plan_record.plan_key LIKE '%starter%') THEN
        result := result || jsonb_build_object(plan_record.product_line, product_entitlements);
      END IF;
    ELSE
      result := result || jsonb_build_object(plan_record.product_line, product_entitlements);
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Create helper functions for product-line aware gating
CREATE OR REPLACE FUNCTION public.is_subscribed_to_product(p_org_id UUID, p_product_line TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  entitlements JSONB;
BEGIN
  entitlements := public.get_org_entitlements(p_org_id);
  RETURN entitlements ? p_product_line;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_product_feature(p_org_id UUID, p_product_line TEXT, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  entitlements JSONB;
  product_features TEXT[];
BEGIN
  entitlements := public.get_org_entitlements(p_org_id);
  
  -- Check if product line exists
  IF NOT (entitlements ? p_product_line) THEN
    RETURN FALSE;
  END IF;
  
  -- Get features array for this product line
  SELECT array(SELECT jsonb_array_elements_text(entitlements->p_product_line->'features'))
  INTO product_features;
  
  RETURN p_feature = ANY(product_features);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_product_limits(p_org_id UUID, p_product_line TEXT)
RETURNS JSONB AS $$
DECLARE
  entitlements JSONB;
BEGIN
  entitlements := public.get_org_entitlements(p_org_id);
  
  -- Return limits for the specific product line, or empty object if not found
  IF entitlements ? p_product_line THEN
    RETURN COALESCE(entitlements->p_product_line->'limits', '{}'::jsonb);
  ELSE
    RETURN '{}'::jsonb;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Update the organization billing summary refresh to use the new aggregator
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
  
  -- Compute product-line grouped entitlements
  computed_entitlements := public.get_org_entitlements(p_org_id);
  
  -- Determine org billing status and next renewal
  IF primary_sub.stripe_subscription_id IS NOT NULL THEN
    org_status := primary_sub.status;
    next_renewal := primary_sub.current_period_end;
  ELSE
    -- No active subscriptions
    org_status := 'inactive';
    next_renewal := NULL;
  END IF;
  
  -- Update the organizations table with product-line aware entitlements
  UPDATE public.organizations 
  SET 
    billing_status = org_status,
    plan_key = COALESCE(primary_sub.plan_key, 'trial'),
    entitlements = computed_entitlements,
    cancel_at_period_end = COALESCE(primary_sub.cancel_at_period_end, false),
    updated_at = now()
  WHERE id = p_org_id;
  
END;
$$ LANGUAGE plpgsql SET search_path = public;