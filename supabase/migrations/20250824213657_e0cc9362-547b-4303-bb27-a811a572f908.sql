-- Fix organizations.suspension_status to support 'canceled' value
-- Update check constraint to include all three states
ALTER TABLE public.organizations 
DROP CONSTRAINT IF EXISTS organizations_suspension_status_check;

ALTER TABLE public.organizations 
ADD CONSTRAINT organizations_suspension_status_check 
CHECK (suspension_status IN ('active', 'suspended', 'canceled'));