-- Update existing leads table to comprehensive schema with strict validation

-- First, add all the new required columns
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS inquiry_type TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS message TEXT,
ADD COLUMN IF NOT EXISTS product_interest TEXT,
ADD COLUMN IF NOT EXISTS additional_requirements TEXT,
ADD COLUMN IF NOT EXISTS expected_volume_label TEXT,
ADD COLUMN IF NOT EXISTS expected_volume_value TEXT,
ADD COLUMN IF NOT EXISTS page_url TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS ip_country TEXT,
ADD COLUMN IF NOT EXISTS accept_privacy BOOLEAN,
ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN,
ADD COLUMN IF NOT EXISTS crm_system TEXT DEFAULT 'suitecrm',
ADD COLUMN IF NOT EXISTS crm_id TEXT,
ADD COLUMN IF NOT EXISTS crm_url TEXT,
ADD COLUMN IF NOT EXISTS crm_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS crm_sync_error TEXT,
ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMP WITH TIME ZONE;

-- Update email column to be required
ALTER TABLE public.leads ALTER COLUMN email SET NOT NULL;

-- Rename expected_volume to avoid confusion with new columns
ALTER TABLE public.leads RENAME COLUMN expected_volume TO legacy_expected_volume;

-- Create comprehensive validation function for leads
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
  
  -- Set default inquiry_type if not provided (for backward compatibility)
  IF NEW.inquiry_type IS NULL THEN
    IF NEW.product_interest IS NOT NULL AND LENGTH(NEW.product_interest) > 0 THEN
      NEW.inquiry_type := 'enterprise';
    ELSE
      NEW.inquiry_type := 'contact';
    END IF;
  END IF;
  
  -- Validate inquiry_type
  IF NEW.inquiry_type NOT IN ('contact', 'enterprise') THEN
    RAISE EXCEPTION 'inquiry_type must be either "contact" or "enterprise"';
  END IF;
  
  -- Set full_name from name if not provided (backward compatibility)
  IF LENGTH(NEW.full_name) = 0 AND NEW.name IS NOT NULL THEN
    NEW.full_name := TRIM(NEW.name);
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
  
  -- Set default consent flags if not provided
  IF NEW.accept_privacy IS NULL THEN
    NEW.accept_privacy := true;
  END IF;
  
  IF NEW.marketing_opt_in IS NULL THEN
    NEW.marketing_opt_in := false;
  END IF;
  
  -- Validate contact form requirements
  IF NEW.inquiry_type = 'contact' THEN
    IF LENGTH(NEW.phone) = 0 THEN
      RAISE EXCEPTION 'phone is required for contact inquiries';
    END IF;
    
    IF LENGTH(NEW.company) = 0 THEN
      RAISE EXCEPTION 'company is required for contact inquiries';
    END IF;
    
    -- Use notes as message for backward compatibility
    IF LENGTH(NEW.message) = 0 AND NEW.notes IS NOT NULL THEN
      NEW.message := TRIM(NEW.notes);
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
    
    -- Use notes as additional_requirements for backward compatibility
    IF LENGTH(NEW.additional_requirements) = 0 AND NEW.notes IS NOT NULL THEN
      NEW.additional_requirements := TRIM(NEW.notes);
    END IF;
    
    IF LENGTH(NEW.additional_requirements) = 0 THEN
      RAISE EXCEPTION 'additional_requirements is required for enterprise inquiries';
    END IF;
    
    -- Use legacy_expected_volume as expected_volume_label for backward compatibility
    IF LENGTH(NEW.expected_volume_label) = 0 AND NEW.legacy_expected_volume IS NOT NULL THEN
      NEW.expected_volume_label := TRIM(NEW.legacy_expected_volume);
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
        -- For backward compatibility, use existing product_line if set
        IF NEW.product_line IS NULL OR LENGTH(NEW.product_line) = 0 THEN
          RAISE EXCEPTION 'Invalid product_interest. Must be "AI Lead Generation" or "AI Customer Service"';
        END IF;
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_lead_submission_trigger ON public.leads;

-- Create trigger for validation
CREATE TRIGGER validate_lead_submission_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_submission();

-- Update RLS policies to be more restrictive
DROP POLICY IF EXISTS "leads_insert_anyone" ON public.leads;
DROP POLICY IF EXISTS "leads_select_own_or_org" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_active_only" ON public.leads;
DROP POLICY IF EXISTS "leads_update_active_only" ON public.leads;
DROP POLICY IF EXISTS "Org members can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Org members can view leads" ON public.leads;

-- Create new strict RLS policies
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
CREATE INDEX IF NOT EXISTS idx_leads_inquiry_type ON public.leads(inquiry_type);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_crm_sync_status ON public.leads(crm_sync_status);