-- Create comprehensive leads table with strict validation and normalization
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core inquiry data
  inquiry_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
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
  accept_privacy BOOLEAN NOT NULL,
  marketing_opt_in BOOLEAN NOT NULL,
  
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

-- Create validation function for leads
CREATE OR REPLACE FUNCTION public.validate_lead_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim all text fields
  NEW.full_name := TRIM(NEW.full_name);
  NEW.email := TRIM(NEW.email);
  NEW.phone := TRIM(COALESCE(NEW.phone, ''));
  NEW.company := TRIM(COALESCE(NEW.company, ''));
  NEW.message := TRIM(COALESCE(NEW.message, ''));
  NEW.product_interest := TRIM(COALESCE(NEW.product_interest, ''));
  NEW.additional_requirements := TRIM(COALESCE(NEW.additional_requirements, ''));
  NEW.expected_volume_label := TRIM(COALESCE(NEW.expected_volume_label, ''));
  
  -- Validate inquiry_type
  IF NEW.inquiry_type NOT IN ('contact', 'enterprise') THEN
    RAISE EXCEPTION 'inquiry_type must be either "contact" or "enterprise"';
  END IF;
  
  -- Validate required fields are non-empty
  IF LENGTH(NEW.full_name) = 0 THEN
    RAISE EXCEPTION 'full_name is required and cannot be empty';
  END IF;
  
  IF LENGTH(NEW.email) = 0 THEN
    RAISE EXCEPTION 'email is required and cannot be empty';
  END IF;
  
  -- Basic email validation
  IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'email must be a valid email address';
  END IF;
  
  -- Validate contact form requirements
  IF NEW.inquiry_type = 'contact' THEN
    IF LENGTH(NEW.phone) = 0 THEN
      RAISE EXCEPTION 'phone is required for contact inquiries';
    END IF;
    
    IF LENGTH(NEW.company) = 0 THEN
      RAISE EXCEPTION 'company is required for contact inquiries';
    END IF;
    
    IF LENGTH(NEW.message) = 0 THEN
      RAISE EXCEPTION 'message is required for contact inquiries';
    END IF;
  END IF;
  
  -- Validate enterprise form requirements
  IF NEW.inquiry_type = 'enterprise' THEN
    IF LENGTH(NEW.company) = 0 THEN
      RAISE EXCEPTION 'company is required for enterprise inquiries';
    END IF;
    
    IF LENGTH(NEW.product_interest) = 0 THEN
      RAISE EXCEPTION 'product_interest is required for enterprise inquiries';
    END IF;
    
    IF LENGTH(NEW.additional_requirements) = 0 THEN
      RAISE EXCEPTION 'additional_requirements is required for enterprise inquiries';
    END IF;
    
    IF LENGTH(NEW.expected_volume_label) = 0 THEN
      RAISE EXCEPTION 'expected_volume_label is required for enterprise inquiries';
    END IF;
    
    -- Derive product_line from product_interest
    CASE NEW.product_interest
      WHEN 'AI Lead Generation' THEN
        NEW.product_line := 'leadgen';
      WHEN 'AI Customer Service' THEN
        NEW.product_line := 'support';
      ELSE
        RAISE EXCEPTION 'Invalid product_interest. Must be "AI Lead Generation" or "AI Customer Service"';
    END CASE;
    
    -- Derive expected_volume_value from expected_volume_label
    CASE NEW.expected_volume_label
      WHEN '< 5,000 calls/month' THEN
        NEW.expected_volume_value := 'lt_5k';
      WHEN '5,000-20,000 calls/month' THEN
        NEW.expected_volume_value := '5k_20k';
      WHEN '20,000-100,000 calls/month' THEN
        NEW.expected_volume_value := '20k_100k';
      WHEN '> 100,000 calls/month' THEN
        NEW.expected_volume_value := 'gt_100k';
      WHEN 'Custom/Variable' THEN
        NEW.expected_volume_value := 'custom';
      ELSE
        RAISE EXCEPTION 'Invalid expected_volume_label. Must be one of the predefined options';
    END CASE;
  END IF;
  
  -- Set updated_at timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
CREATE TRIGGER validate_lead_submission_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_submission();

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can insert, admins can read/manage
CREATE POLICY "leads_insert_service_only" 
ON public.leads 
FOR INSERT 
WITH CHECK (false); -- Only service role can insert

CREATE POLICY "leads_select_admin_only" 
ON public.leads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE user_id = auth.uid()
  )
);

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
CREATE INDEX idx_leads_inquiry_type ON public.leads(inquiry_type);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_crm_sync_status ON public.leads(crm_sync_status);

-- Drop the old leads table if it exists and conflicts
DROP TABLE IF EXISTS public.leads_old CASCADE;