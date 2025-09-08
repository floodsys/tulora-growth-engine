-- Create CRM outbox table for managing sync queue with exponential backoff
CREATE TABLE public.crm_outbox (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  crm_system TEXT NOT NULL DEFAULT 'suitecrm',
  
  -- Ensure one entry per lead per CRM system
  UNIQUE(lead_id, crm_system)
);

-- Add index for efficient worker queries
CREATE INDEX idx_crm_outbox_next_attempt ON public.crm_outbox (next_attempt_at, status) 
WHERE status IN ('pending', 'failed');

-- Add index for organization-based queries
CREATE INDEX idx_crm_outbox_organization ON public.crm_outbox (organization_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.crm_outbox ENABLE ROW LEVEL SECURITY;

-- Create policies for CRM outbox
CREATE POLICY "Org admins can view CRM outbox" 
ON public.crm_outbox 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = crm_outbox.organization_id AND owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = crm_outbox.organization_id 
      AND user_id = auth.uid() 
      AND role = 'admin'::org_role 
      AND seat_active = true
  )
);

CREATE POLICY "System can manage CRM outbox" 
ON public.crm_outbox 
FOR ALL 
USING (false);

-- Add new columns to leads table for CRM sync tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS crm_sync_status TEXT DEFAULT 'pending' CHECK (crm_sync_status IN ('pending', 'syncing', 'synced', 'failed')),
ADD COLUMN IF NOT EXISTS crm_sync_error TEXT,
ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS crm_url TEXT;

-- Create function to enqueue lead for CRM sync
CREATE OR REPLACE FUNCTION public.enqueue_crm_sync(p_lead_id UUID, p_organization_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_outbox (lead_id, organization_id, next_attempt_at)
  VALUES (p_lead_id, p_organization_id, now())
  ON CONFLICT (lead_id, crm_system) 
  DO UPDATE SET 
    next_attempt_at = now(),
    status = 'pending',
    updated_at = now();
END;
$$;

-- Create function to calculate next retry delay with exponential backoff
CREATE OR REPLACE FUNCTION public.calculate_next_retry(attempt_count INTEGER)
RETURNS INTERVAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Exponential backoff: 5m, 30m, 2h, 24h
  CASE attempt_count
    WHEN 0, 1 THEN RETURN INTERVAL '5 minutes';
    WHEN 2 THEN RETURN INTERVAL '30 minutes';
    WHEN 3 THEN RETURN INTERVAL '2 hours';
    ELSE RETURN INTERVAL '24 hours';
  END CASE;
END;
$$;

-- Create trigger to automatically enqueue new leads for CRM sync
CREATE OR REPLACE FUNCTION public.auto_enqueue_lead_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enqueue if organization_id is present and not already synced
  IF NEW.organization_id IS NOT NULL AND NEW.crm_sync_status = 'pending' THEN
    PERFORM public.enqueue_crm_sync(NEW.id, NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to leads table
DROP TRIGGER IF EXISTS trigger_auto_enqueue_lead_sync ON public.leads;
CREATE TRIGGER trigger_auto_enqueue_lead_sync
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enqueue_lead_sync();