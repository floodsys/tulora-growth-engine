-- Add email delivery tracking columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
ADD COLUMN IF NOT EXISTS email_message_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS email_delivery_error TEXT;