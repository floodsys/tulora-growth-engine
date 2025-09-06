-- Create leads table for contact sales form submissions
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  product_line TEXT CHECK (product_line IN ('leadgen', 'support')),
  expected_volume TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new',
  source TEXT DEFAULT 'contact_sales',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads table
CREATE POLICY "leads_insert_policy" ON public.leads 
FOR INSERT 
WITH CHECK (true); -- Allow anyone to insert leads

CREATE POLICY "leads_select_own" ON public.leads 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_product_line ON public.leads(product_line);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_leads_updated_at();