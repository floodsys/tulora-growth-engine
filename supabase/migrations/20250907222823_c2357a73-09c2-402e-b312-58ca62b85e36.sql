-- Add setup fee tracking fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN setup_fee_status TEXT DEFAULT 'pending' CHECK (setup_fee_status IN ('pending', 'collected_off_platform', 'waived')),
ADD COLUMN setup_fee_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.setup_fee_status IS 'Admin-only tracking of setup fee collection status';
COMMENT ON COLUMN public.organizations.setup_fee_notes IS 'Admin-only notes about setup fee collection';