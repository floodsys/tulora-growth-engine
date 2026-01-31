-- Create comprehensive leads table with strict validation and normalization (idempotent)
-- If the leads table already exists, add missing columns

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core inquiry data
  inquiry_type TEXT,
  full_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  
  -- Contact form specific
  message TEXT,
  
  -- Enterprise form specific  
  product_interest TEXT,
  product_line TEXT,
  additional_requirements TEXT,
  expected_volume_label TEXT,
  expected_volume_value TEXT,
  
  -- Tracking data (autofilled)
  page_url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  ip_country TEXT,
  
  -- Consent flags
  accept_privacy BOOLEAN,
  marketing_opt_in BOOLEAN,
  
  -- CRM sync bookkeeping
  crm_system TEXT DEFAULT 'suitecrm',
  crm_id TEXT,
  crm_url TEXT,
  crm_sync_status TEXT DEFAULT 'pending',
  crm_sync_error TEXT,
  crm_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add any missing columns to existing leads table
DO $$
BEGIN
  -- inquiry_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'inquiry_type') THEN
    ALTER TABLE public.leads ADD COLUMN inquiry_type TEXT;
  END IF;
  -- full_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'full_name') THEN
    ALTER TABLE public.leads ADD COLUMN full_name TEXT;
  END IF;
  -- message
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'message') THEN
    ALTER TABLE public.leads ADD COLUMN message TEXT;
  END IF;
  -- product_interest
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'product_interest') THEN
    ALTER TABLE public.leads ADD COLUMN product_interest TEXT;
  END IF;
  -- additional_requirements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'additional_requirements') THEN
    ALTER TABLE public.leads ADD COLUMN additional_requirements TEXT;
  END IF;
  -- expected_volume_label
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'expected_volume_label') THEN
    ALTER TABLE public.leads ADD COLUMN expected_volume_label TEXT;
  END IF;
  -- expected_volume_value
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'expected_volume_value') THEN
    ALTER TABLE public.leads ADD COLUMN expected_volume_value TEXT;
  END IF;
  -- page_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'page_url') THEN
    ALTER TABLE public.leads ADD COLUMN page_url TEXT;
  END IF;
  -- referrer
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'referrer') THEN
    ALTER TABLE public.leads ADD COLUMN referrer TEXT;
  END IF;
  -- utm_source
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'utm_source') THEN
    ALTER TABLE public.leads ADD COLUMN utm_source TEXT;
  END IF;
  -- utm_medium
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'utm_medium') THEN
    ALTER TABLE public.leads ADD COLUMN utm_medium TEXT;
  END IF;
  -- utm_campaign
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'utm_campaign') THEN
    ALTER TABLE public.leads ADD COLUMN utm_campaign TEXT;
  END IF;
  -- utm_term
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'utm_term') THEN
    ALTER TABLE public.leads ADD COLUMN utm_term TEXT;
  END IF;
  -- utm_content
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'utm_content') THEN
    ALTER TABLE public.leads ADD COLUMN utm_content TEXT;
  END IF;
  -- ip_country
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'ip_country') THEN
    ALTER TABLE public.leads ADD COLUMN ip_country TEXT;
  END IF;
  -- accept_privacy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'accept_privacy') THEN
    ALTER TABLE public.leads ADD COLUMN accept_privacy BOOLEAN;
  END IF;
  -- marketing_opt_in
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'marketing_opt_in') THEN
    ALTER TABLE public.leads ADD COLUMN marketing_opt_in BOOLEAN;
  END IF;
  -- crm_system
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'crm_system') THEN
    ALTER TABLE public.leads ADD COLUMN crm_system TEXT DEFAULT 'suitecrm';
  END IF;
  -- crm_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'crm_id') THEN
    ALTER TABLE public.leads ADD COLUMN crm_id TEXT;
  END IF;
  -- crm_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'crm_url') THEN
    ALTER TABLE public.leads ADD COLUMN crm_url TEXT;
  END IF;
  -- crm_sync_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'crm_sync_status') THEN
    ALTER TABLE public.leads ADD COLUMN crm_sync_status TEXT DEFAULT 'pending';
  END IF;
  -- crm_sync_error
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'crm_sync_error') THEN
    ALTER TABLE public.leads ADD COLUMN crm_sync_error TEXT;
  END IF;
  -- crm_synced_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'crm_synced_at') THEN
    ALTER TABLE public.leads ADD COLUMN crm_synced_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create validation function for leads
CREATE OR REPLACE FUNCTION public.validate_lead_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim all text fields
  NEW.full_name := TRIM(COALESCE(NEW.full_name, ''));
  NEW.email := TRIM(NEW.email);
  NEW.phone := TRIM(COALESCE(NEW.phone, ''));
  NEW.company := TRIM(COALESCE(NEW.company, ''));
  NEW.message := TRIM(COALESCE(NEW.message, ''));
  NEW.product_interest := TRIM(COALESCE(NEW.product_interest, ''));
  NEW.additional_requirements := TRIM(COALESCE(NEW.additional_requirements, ''));
  NEW.expected_volume_label := TRIM(COALESCE(NEW.expected_volume_label, ''));
  
  -- Set updated_at timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_lead_submission_trigger ON public.leads;
CREATE TRIGGER validate_lead_submission_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_submission();

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can insert, admins can read/manage
DROP POLICY IF EXISTS "leads_insert_service_only" ON public.leads;
CREATE POLICY "leads_insert_service_only" 
ON public.leads 
FOR INSERT 
WITH CHECK (false); -- Only service role can insert

DROP POLICY IF EXISTS "leads_select_admin_only" ON public.leads;
CREATE POLICY "leads_select_admin_only" 
ON public.leads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "leads_update_admin_only" ON public.leads;
CREATE POLICY "leads_update_admin_only" 
ON public.leads 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "leads_delete_admin_only" ON public.leads;
CREATE POLICY "leads_delete_admin_only" 
ON public.leads 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_inquiry_type ON public.leads(inquiry_type);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_crm_sync_status ON public.leads(crm_sync_status);

-- Drop the old leads table if it exists and conflicts
DROP TABLE IF EXISTS public.leads_old CASCADE;
