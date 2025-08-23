-- High-ticket model configuration - Step 1: Fix role enum and create tables

-- Create enum for roles (exact requirements: admin, editor, viewer, user)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
        CREATE TYPE public.org_role AS ENUM ('admin', 'editor', 'viewer', 'user');
    END IF;
END$$;

-- Fix organization_members role column
DO $$
BEGIN
    -- Drop default first to avoid casting issues
    ALTER TABLE public.organization_members ALTER COLUMN role DROP DEFAULT;
    -- Then convert to enum
    ALTER TABLE public.organization_members 
    ALTER COLUMN role TYPE public.org_role USING role::public.org_role;
    -- Set new default
    ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'user';
END$$;

-- Create demo_sessions table for sandbox tracking
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  actions_performed JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Create plan_configs table for subscription plans
CREATE TABLE IF NOT EXISTS public.plan_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_monthly INTEGER, -- in cents
  price_yearly INTEGER,  -- in cents
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  limits JSONB NOT NULL DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert plan configurations including trial
INSERT INTO public.plan_configs (plan_key, display_name, price_monthly, price_yearly, limits, features, stripe_price_id_monthly, stripe_price_id_yearly) VALUES
('trial', 'Trial', 0, 0, 
 '{"agents": 1, "seats": 3, "calls_per_month": 100, "storage_gb": 5, "integrations": ["basic_calendar"]}',
 '{"basic_calendar", "email_support", "knowledge_base"}',
 NULL, NULL
),
('starter', 'Starter', 49700, 497000, 
 '{"agents": 5, "seats": 10, "calls_per_month": 1000, "storage_gb": 25, "integrations": ["basic_calendar", "email"]}',
 '{"advanced_calendar", "voice_sms", "basic_analytics", "email_support", "knowledge_base", "crm_basic"}',
 'price_starter_monthly', 'price_starter_yearly'
),
('business', 'Business', 149700, 1497000,
 '{"agents": null, "seats": null, "calls_per_month": null, "storage_gb": 500, "integrations": ["all"]}',
 '{"advanced_calendar", "voice_sms", "advanced_analytics", "priority_support", "crm_integrations", "ab_testing", "white_label", "account_manager", "api_access", "custom_integrations"}',
 'price_business_monthly', 'price_business_yearly'
)
ON CONFLICT (plan_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_price_id_yearly = EXCLUDED.stripe_price_id_yearly,
  updated_at = now();

-- Add trial and demo columns to organizations (now that plan_configs exists)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS plan_key TEXT DEFAULT 'trial' REFERENCES public.plan_configs(plan_key);

-- Create activity_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create org_subscriptions table for Stripe sync
CREATE TABLE IF NOT EXISTS public.org_stripe_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan_key TEXT,
  status TEXT NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  quantity INTEGER DEFAULT 1,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_stripe_subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.plan_configs IS 'Configuration for subscription plans and their limits';
COMMENT ON TABLE public.activity_logs IS 'Audit log for user actions and system events';
COMMENT ON TABLE public.demo_sessions IS 'Tracking for demo sandbox sessions';
COMMENT ON TABLE public.org_stripe_subscriptions IS 'Stripe subscription sync data';