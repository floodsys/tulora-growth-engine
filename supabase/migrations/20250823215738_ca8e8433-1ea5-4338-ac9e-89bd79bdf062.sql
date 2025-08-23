-- High-ticket model configuration with org isolation and roles (Fixed)

-- Create enum for roles (exact requirements: admin, editor, viewer, user)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
        CREATE TYPE public.org_role AS ENUM ('admin', 'editor', 'viewer', 'user');
    END IF;
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

-- Update organization_members table to use proper role enum
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_members' AND column_name = 'role') THEN
        ALTER TABLE public.organization_members 
        ALTER COLUMN role TYPE public.org_role USING role::public.org_role;
    END IF;
END$$;

-- Enable RLS on all new tables
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org isolation

-- Plan configs are publicly readable (for pricing page)
CREATE POLICY "Plan configs are publicly readable" ON public.plan_configs
FOR SELECT USING (is_active = true);

-- Activity logs: only org members can view their org's logs
CREATE POLICY "Org members can view activity logs" ON public.activity_logs
FOR SELECT USING (is_org_member(organization_id));

-- System can insert activity logs (via edge functions)
CREATE POLICY "System can insert activity logs" ON public.activity_logs
FOR INSERT WITH CHECK (true);

-- Demo sessions: publicly accessible for sandbox
CREATE POLICY "Demo sessions public access" ON public.demo_sessions
FOR ALL USING (true);

-- Org subscriptions: org members can view, system can modify
CREATE POLICY "Org members can view subscriptions" ON public.org_stripe_subscriptions
FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "System can manage subscriptions" ON public.org_stripe_subscriptions
FOR ALL USING (true);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_plan_configs_updated_at') THEN
        CREATE TRIGGER update_plan_configs_updated_at
          BEFORE UPDATE ON public.plan_configs
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_org_stripe_subscriptions_updated_at') THEN
        CREATE TRIGGER update_org_stripe_subscriptions_updated_at
          BEFORE UPDATE ON public.org_stripe_subscriptions
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END$$;

-- Functions for feature gating and activity logging

-- Log user activities
CREATE OR REPLACE FUNCTION public.log_activity(
  p_org_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (
    organization_id,
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    p_org_id,
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Check feature access based on plan
CREATE OR REPLACE FUNCTION public.has_feature(
  p_org_id UUID,
  p_feature TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  plan_features TEXT[];
BEGIN
  -- Get organization plan info
  SELECT o.plan_key, o.billing_status, p.features
  INTO org_record
  FROM public.organizations o
  LEFT JOIN public.plan_configs p ON p.plan_key = o.plan_key
  WHERE o.id = p_org_id;
  
  -- If no plan or inactive billing, deny premium features
  IF org_record.plan_key IS NULL OR 
     org_record.billing_status NOT IN ('active', 'trialing') THEN
    RETURN false;
  END IF;
  
  -- Check if feature is in plan
  plan_features := org_record.features;
  RETURN p_feature = ANY(plan_features);
END;
$$;

-- Check usage limits
CREATE OR REPLACE FUNCTION public.can_perform_action(
  p_org_id UUID,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  plan_limits JSONB;
  current_count INTEGER;
  limit_value INTEGER;
BEGIN
  -- Get organization and plan info
  SELECT o.plan_key, o.billing_status, o.entitlements, p.limits
  INTO org_record
  FROM public.organizations o
  LEFT JOIN public.plan_configs p ON p.plan_key = o.plan_key
  WHERE o.id = p_org_id;
  
  -- If no active billing, deny most actions
  IF org_record.billing_status NOT IN ('active', 'trialing') THEN
    RETURN false;
  END IF;
  
  -- Use entitlements if available, otherwise plan limits
  plan_limits := COALESCE(org_record.entitlements, org_record.limits, '{}'::jsonb);
  
  -- Check specific action limits
  CASE p_action
    WHEN 'create_agent' THEN
      limit_value := (plan_limits->>'agents')::INTEGER;
      IF limit_value IS NOT NULL THEN
        SELECT COUNT(*) INTO current_count
        FROM public.agent_profiles
        WHERE organization_id = p_org_id AND status = 'active';
        RETURN current_count < limit_value;
      END IF;
      
    WHEN 'add_seat' THEN
      limit_value := (plan_limits->>'seats')::INTEGER;
      IF limit_value IS NOT NULL THEN
        SELECT COUNT(*) INTO current_count
        FROM public.organization_members
        WHERE organization_id = p_org_id AND seat_active = true;
        RETURN current_count < limit_value;
      END IF;
      
    WHEN 'make_call' THEN
      limit_value := (plan_limits->>'calls_per_month')::INTEGER;
      IF limit_value IS NOT NULL THEN
        SELECT COUNT(*) INTO current_count
        FROM public.calls
        WHERE organization_id = p_org_id 
          AND created_at >= date_trunc('month', CURRENT_DATE);
        RETURN current_count < limit_value;
      END IF;
  END CASE;
  
  RETURN true; -- No limits found or unlimited plan
END;
$$;

-- Ensure owner gets admin membership on org creation
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name TEXT,
  p_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_id UUID;
  user_id UUID;
BEGIN
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Insert organization with owner
  INSERT INTO public.organizations (name, slug, owner_user_id, plan_key, trial_started_at, trial_ends_at)
  VALUES (p_name, p_slug, user_id, 'trial', now(), now() + interval '14 days')
  RETURNING id INTO org_id;
  
  -- Add owner as admin member
  INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
  VALUES (org_id, user_id, 'admin', true);
  
  -- Log organization creation
  PERFORM public.log_activity(org_id, user_id, 'organization_created', 'organization', org_id, 
    jsonb_build_object('name', p_name, 'slug', p_slug));
  
  RETURN org_id;
END;
$$;

COMMENT ON TABLE public.plan_configs IS 'Configuration for subscription plans and their limits';
COMMENT ON TABLE public.activity_logs IS 'Audit log for user actions and system events';
COMMENT ON TABLE public.demo_sessions IS 'Tracking for demo sandbox sessions';
COMMENT ON TABLE public.org_stripe_subscriptions IS 'Stripe subscription sync data';

COMMENT ON FUNCTION public.has_feature IS 'Check if organization has access to specific feature';
COMMENT ON FUNCTION public.can_perform_action IS 'Check if organization can perform action based on plan limits';
COMMENT ON FUNCTION public.log_activity IS 'Log user activity for audit and analytics purposes';
COMMENT ON FUNCTION public.create_organization_with_owner IS 'Create organization with proper owner setup';