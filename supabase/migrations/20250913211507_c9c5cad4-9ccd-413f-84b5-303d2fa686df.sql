-- Phase 7: SMS/10DLC Brand and Campaign Registration

-- SMS Brand Registration table
CREATE TABLE public.sms_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  brand_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  tax_id TEXT,
  website TEXT,
  industry TEXT,
  phone_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  registration_status TEXT NOT NULL DEFAULT 'pending',
  brand_id TEXT, -- From carrier/provider
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SMS Campaign Registration table
CREATE TABLE public.sms_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'standard',
  use_case TEXT NOT NULL,
  sample_messages TEXT[] DEFAULT '{}',
  monthly_volume INTEGER DEFAULT 1000,
  registration_status TEXT NOT NULL DEFAULT 'pending',
  campaign_id TEXT, -- From carrier/provider
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SMS Messages table for tracking
CREATE TABLE public.sms_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  campaign_id UUID,
  number_id UUID,
  direction TEXT NOT NULL, -- 'inbound' or 'outbound'
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  error_code TEXT,
  error_message TEXT,
  provider_message_id TEXT,
  cost_cents INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all SMS tables
ALTER TABLE public.sms_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for SMS Brands
CREATE POLICY "Org members can view sms_brands" 
ON public.sms_brands 
FOR SELECT 
USING (is_org_member(organization_id));

CREATE POLICY "Org members can manage sms_brands" 
ON public.sms_brands 
FOR ALL 
USING (is_org_member(organization_id));

CREATE POLICY "sms_brands_insert_active_only" 
ON public.sms_brands 
FOR INSERT 
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

CREATE POLICY "sms_brands_update_active_only" 
ON public.sms_brands 
FOR UPDATE 
USING (is_org_active(organization_id) AND is_org_member(organization_id))
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- RLS Policies for SMS Campaigns
CREATE POLICY "Org members can view sms_campaigns" 
ON public.sms_campaigns 
FOR SELECT 
USING (is_org_member(organization_id));

CREATE POLICY "Org members can manage sms_campaigns" 
ON public.sms_campaigns 
FOR ALL 
USING (is_org_member(organization_id));

CREATE POLICY "sms_campaigns_insert_active_only" 
ON public.sms_campaigns 
FOR INSERT 
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

CREATE POLICY "sms_campaigns_update_active_only" 
ON public.sms_campaigns 
FOR UPDATE 
USING (is_org_active(organization_id) AND is_org_member(organization_id))
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- RLS Policies for SMS Messages
CREATE POLICY "Org members can view sms_messages" 
ON public.sms_messages 
FOR SELECT 
USING (is_org_member(organization_id));

CREATE POLICY "Org members can manage sms_messages" 
ON public.sms_messages 
FOR ALL 
USING (is_org_member(organization_id));

CREATE POLICY "sms_messages_insert_active_only" 
ON public.sms_messages 
FOR INSERT 
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- Foreign key constraints
ALTER TABLE public.sms_campaigns ADD CONSTRAINT fk_sms_campaigns_brand 
FOREIGN KEY (brand_id) REFERENCES public.sms_brands(id) ON DELETE CASCADE;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_sms_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_sms_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_sms_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sms_brands_updated_at
BEFORE UPDATE ON public.sms_brands
FOR EACH ROW
EXECUTE FUNCTION public.update_sms_brands_updated_at();

CREATE TRIGGER update_sms_campaigns_updated_at
BEFORE UPDATE ON public.sms_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_sms_campaigns_updated_at();

CREATE TRIGGER update_sms_messages_updated_at
BEFORE UPDATE ON public.sms_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_sms_messages_updated_at();

-- Indexes for performance
CREATE INDEX idx_sms_brands_org_id ON public.sms_brands(organization_id);
CREATE INDEX idx_sms_campaigns_org_id ON public.sms_campaigns(organization_id);
CREATE INDEX idx_sms_campaigns_brand_id ON public.sms_campaigns(brand_id);
CREATE INDEX idx_sms_messages_org_id ON public.sms_messages(organization_id);
CREATE INDEX idx_sms_messages_campaign_id ON public.sms_messages(campaign_id);
CREATE INDEX idx_sms_messages_number_id ON public.sms_messages(number_id);
CREATE INDEX idx_sms_messages_created_at ON public.sms_messages(created_at);
CREATE INDEX idx_sms_messages_delivery_status ON public.sms_messages(delivery_status);