-- Add setup fee billing toggle to plan_configs table
ALTER TABLE public.plan_configs 
ADD COLUMN bill_setup_fee_in_stripe BOOLEAN NOT NULL DEFAULT false;