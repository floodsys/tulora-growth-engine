-- Create sales_invoices table for tracking invoice requests
CREATE TABLE public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  stripe_invoice_id TEXT,
  invoice_url TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'cad',
  status TEXT DEFAULT 'draft', -- draft, open, paid, void, uncollectible
  payment_method TEXT DEFAULT 'acss_debit',
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "sales_invoices_insert_authenticated" ON public.sales_invoices;
CREATE POLICY "sales_invoices_insert_authenticated" ON public.sales_invoices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sales_invoices_select_own" ON public.sales_invoices;
CREATE POLICY "sales_invoices_select_own" ON public.sales_invoices
FOR SELECT
USING (auth.uid() = user_id OR is_org_admin(organization_id));

-- Superadmin can view all invoices
DROP POLICY IF EXISTS "sales_invoices_select_admin" ON public.sales_invoices;
CREATE POLICY "sales_invoices_select_admin" ON public.sales_invoices
FOR SELECT
USING (is_superadmin());

-- Create indexes
CREATE INDEX idx_sales_invoices_user_id ON public.sales_invoices(user_id);
CREATE INDEX idx_sales_invoices_organization_id ON public.sales_invoices(organization_id);
CREATE INDEX idx_sales_invoices_status ON public.sales_invoices(status);
CREATE INDEX idx_sales_invoices_created_at ON public.sales_invoices(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_sales_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sales_invoices_updated_at ON public.sales_invoices;
CREATE TRIGGER update_sales_invoices_updated_at
  BEFORE UPDATE ON public.sales_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_sales_invoices_updated_at();
