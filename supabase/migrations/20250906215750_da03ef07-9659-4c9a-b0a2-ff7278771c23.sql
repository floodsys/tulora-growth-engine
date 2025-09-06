-- Update leads table for contact sales functionality
-- Add missing columns for contact sales
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS product_line TEXT CHECK (product_line IN ('leadgen', 'support')),
ADD COLUMN IF NOT EXISTS expected_volume TEXT;

-- Make organization_id nullable since contact sales can come from non-logged-in users
ALTER TABLE public.leads ALTER COLUMN organization_id DROP NOT NULL;

-- Update RLS policies for contact sales
DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_select_own" ON public.leads;

-- New policies for contact sales
CREATE POLICY "leads_insert_anyone" ON public.leads 
FOR INSERT 
WITH CHECK (true); -- Allow anyone to insert leads

CREATE POLICY "leads_select_own_or_org" ON public.leads 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  (organization_id IS NOT NULL AND is_org_member(organization_id))
);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_product_line ON public.leads(product_line);