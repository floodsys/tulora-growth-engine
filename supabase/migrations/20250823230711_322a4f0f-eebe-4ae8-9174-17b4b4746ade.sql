-- Update organizations table to track billing information
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS plan_key TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'trialing',
ADD COLUMN IF NOT EXISTS entitlements JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');

-- Create plan_configs table for plan definitions
CREATE TABLE IF NOT EXISTS public.plan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_monthly INTEGER, -- Price in cents
  price_yearly INTEGER,  -- Price in cents
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert plan configurations
INSERT INTO public.plan_configs (plan_key, display_name, price_monthly, price_yearly, limits, features) VALUES
('pro', 'Pro', 9900, 10692, '{"agents": 10, "seats": 20, "calls_per_month": 5000, "storage_gb": 100}'::jsonb, ARRAY['advanced_analytics', 'voice_sms', 'crm_integrations', 'email_support']),
('business', 'Business', 29900, 32292, '{"agents": null, "seats": null, "calls_per_month": null, "storage_gb": 500}'::jsonb, ARRAY['advanced_analytics', 'voice_sms', 'crm_integrations', 'email_support', 'white_label', 'api_access', 'account_manager', 'priority_support'])
ON CONFLICT (plan_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  updated_at = now();

-- Enable RLS on plan_configs
ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

-- Create policy for plan configs to be publicly readable
CREATE POLICY "Plan configs are publicly readable" ON public.plan_configs
FOR SELECT USING (is_active = true);

-- Create org_subscriptions table to track Stripe subscriptions
CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL,
  price_id TEXT,
  product_id TEXT,
  quantity INTEGER DEFAULT 1,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  subscription_item_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on org_subscriptions
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for org members to read their org's subscription
CREATE POLICY "org_subscriptions read for members" ON public.org_subscriptions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = org_subscriptions.org_id 
    AND m.user_id = auth.uid()
  )
);

-- Create trigger to update updated_at on org_subscriptions
CREATE OR REPLACE FUNCTION public.update_org_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE TRIGGER update_org_subscriptions_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_org_subscriptions_updated_at();