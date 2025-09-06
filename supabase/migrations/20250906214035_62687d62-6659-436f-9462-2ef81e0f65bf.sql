-- Extend plan_configs table to support multiple product lines and setup fees
-- Add product_line column with enum constraint
DO $$ 
BEGIN
    -- Add product_line column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'plan_configs' 
                   AND column_name = 'product_line') THEN
        ALTER TABLE public.plan_configs 
        ADD COLUMN product_line TEXT DEFAULT 'leadgen';
        
        -- Add constraint for valid product line values
        ALTER TABLE public.plan_configs 
        ADD CONSTRAINT plan_configs_product_line_check 
        CHECK (product_line IN ('leadgen', 'support'));
        
        RAISE NOTICE 'Added product_line column with default leadgen';
    END IF;
END $$;

-- Add stripe_setup_price_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'plan_configs' 
                   AND column_name = 'stripe_setup_price_id') THEN
        ALTER TABLE public.plan_configs 
        ADD COLUMN stripe_setup_price_id TEXT NULL;
        
        RAISE NOTICE 'Added stripe_setup_price_id column';
    END IF;
END $$;

-- Update existing records to have explicit product_line if not set
UPDATE public.plan_configs 
SET product_line = 'leadgen' 
WHERE product_line IS NULL;

-- Add helpful comment to table
COMMENT ON TABLE public.plan_configs IS 'Configuration for billing plans supporting multiple product lines (leadgen, support) with optional setup fees';
COMMENT ON COLUMN public.plan_configs.product_line IS 'Product line: leadgen for lead generation plans, support for customer support plans';
COMMENT ON COLUMN public.plan_configs.stripe_setup_price_id IS 'Optional Stripe price ID for one-time setup fee';
COMMENT ON COLUMN public.plan_configs.stripe_price_id_monthly IS 'Stripe price ID for monthly billing';
COMMENT ON COLUMN public.plan_configs.stripe_price_id_yearly IS 'Stripe price ID for yearly billing (can be null if not offered)';
COMMENT ON COLUMN public.plan_configs.limits IS 'JSON object containing plan limits (agents, calls_per_month, seats, etc.)';
COMMENT ON COLUMN public.plan_configs.features IS 'Array of feature keys available in this plan';
COMMENT ON COLUMN public.plan_configs.is_active IS 'Whether this plan is currently active and available for signup';

-- Create index on product_line for better query performance
CREATE INDEX IF NOT EXISTS idx_plan_configs_product_line 
ON public.plan_configs(product_line);

-- Create index on active plans for better query performance
CREATE INDEX IF NOT EXISTS idx_plan_configs_active 
ON public.plan_configs(is_active) WHERE is_active = true;