-- Add delivery_status field to leads table for tracking email delivery
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending';

-- Add index for delivery status queries
CREATE INDEX IF NOT EXISTS idx_leads_delivery_status ON public.leads(delivery_status);

-- Add email_message_ids field to track sent email IDs
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS email_message_ids jsonb DEFAULT '[]'::jsonb;