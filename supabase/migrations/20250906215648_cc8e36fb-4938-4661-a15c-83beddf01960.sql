-- Create leads table for contact sales form submissions (idempotent)
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

-- Add missing columns to existing leads table if needed
DO $$
BEGIN
    -- Add user_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'user_id') THEN
        ALTER TABLE public.leads ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added user_id column to leads table';
    END IF;
    
    -- Add product_line if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'product_line') THEN
        ALTER TABLE public.leads ADD COLUMN product_line TEXT;
        RAISE NOTICE 'Added product_line column to leads table';
    END IF;
    
    -- Add expected_volume if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'expected_volume') THEN
        ALTER TABLE public.leads ADD COLUMN expected_volume TEXT;
        RAISE NOTICE 'Added expected_volume column to leads table';
    END IF;
    
    -- Add notes if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'notes') THEN
        ALTER TABLE public.leads ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to leads table';
    END IF;
    
    -- Add source if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source') THEN
        ALTER TABLE public.leads ADD COLUMN source TEXT DEFAULT 'contact_sales';
        RAISE NOTICE 'Added source column to leads table';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads table (only if user_id column exists)
DO $$
BEGIN
    -- Drop existing policies first
    DROP POLICY IF EXISTS "leads_insert_policy" ON public.leads;
    DROP POLICY IF EXISTS "leads_select_own" ON public.leads;
    
    -- Create insert policy (allow anyone to insert leads)
    CREATE POLICY "leads_insert_policy" ON public.leads 
    FOR INSERT 
    WITH CHECK (true);
    
    -- Create select policy (only if user_id column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'user_id') THEN
        CREATE POLICY "leads_select_own" ON public.leads 
        FOR SELECT 
        USING (auth.uid() = user_id OR auth.uid() IS NULL);
        RAISE NOTICE 'Created leads_select_own policy using user_id';
    ELSE
        -- Fallback if user_id doesn't exist for some reason
        CREATE POLICY "leads_select_own" ON public.leads 
        FOR SELECT 
        USING (true);
        RAISE NOTICE 'Created fallback leads_select_own policy without user_id';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Policies already exist';
END $$;

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

DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_leads_updated_at();
