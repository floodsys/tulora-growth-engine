-- Fix idempotency: ensure proper UNIQUE constraint and normalization trigger

-- Ensure column exists
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS external_id text;

-- Create normalization trigger function
CREATE OR REPLACE FUNCTION public.normalize_external_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.external_id IS NOT NULL THEN
    NEW.external_id := lower(trim(NEW.external_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS normalize_external_id_trigger ON public.leads;

-- Create trigger to normalize external_id on insert/update
CREATE TRIGGER normalize_external_id_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_external_id();

-- Drop the index created in previous migration (we need constraint instead)
DROP INDEX IF EXISTS public.leads_external_id_key;

-- Drop existing constraint if it exists and add proper UNIQUE constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_external_id_unique;
ALTER TABLE public.leads ADD CONSTRAINT leads_external_id_unique UNIQUE (external_id);