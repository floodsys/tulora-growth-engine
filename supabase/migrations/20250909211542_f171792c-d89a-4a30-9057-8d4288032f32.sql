-- Add external_id column to leads table for idempotency
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS external_id text;

-- Create unique index for external_id with case-insensitive lookup and null handling
CREATE UNIQUE INDEX IF NOT EXISTS leads_external_id_key 
ON public.leads (lower(external_id)) 
WHERE external_id IS NOT NULL;