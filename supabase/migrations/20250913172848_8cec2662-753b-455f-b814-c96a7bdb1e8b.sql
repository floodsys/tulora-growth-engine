-- Create usage_rollups table for aggregated usage data
CREATE TABLE IF NOT EXISTS public.usage_rollups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year_month DATE NOT NULL, -- First day of the month for the period
  minutes INTEGER NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  kb_ops INTEGER NOT NULL DEFAULT 0,
  concurrency_peak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one rollup per org per month
  UNIQUE(organization_id, year_month)
);

-- Enable RLS
ALTER TABLE public.usage_rollups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Org members can view usage rollups" ON public.usage_rollups;
CREATE POLICY "Org members can view usage rollups" 
ON public.usage_rollups 
FOR SELECT 
USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "System can manage usage rollups" ON public.usage_rollups;
CREATE POLICY "System can manage usage rollups" 
ON public.usage_rollups 
FOR ALL 
USING (false);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_usage_rollups_updated_at ON public.usage_rollups;
CREATE TRIGGER update_usage_rollups_updated_at
BEFORE UPDATE ON public.usage_rollups
FOR EACH ROW
EXECUTE FUNCTION public.update_usage_rollups_updated_at();

-- Add index for efficient queries
CREATE INDEX idx_usage_rollups_org_period ON public.usage_rollups(organization_id, year_month);

-- Function to get or create current month rollup
CREATE OR REPLACE FUNCTION public.get_or_create_usage_rollup(p_org_id UUID, p_period DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rollup_id UUID;
BEGIN
  -- Try to get existing rollup
  SELECT id INTO rollup_id
  FROM public.usage_rollups
  WHERE organization_id = p_org_id AND year_month = p_period;
  
  -- Create if doesn't exist
  IF rollup_id IS NULL THEN
    INSERT INTO public.usage_rollups (organization_id, year_month)
    VALUES (p_org_id, p_period)
    RETURNING id INTO rollup_id;
  END IF;
  
  RETURN rollup_id;
END;
$$;

-- Function to update rollup counters
CREATE OR REPLACE FUNCTION public.update_usage_rollup(
  p_org_id UUID,
  p_period DATE,
  p_minutes INTEGER DEFAULT 0,
  p_calls INTEGER DEFAULT 0,
  p_messages INTEGER DEFAULT 0,
  p_kb_ops INTEGER DEFAULT 0,
  p_concurrency_peak INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.usage_rollups (
    organization_id, 
    year_month, 
    minutes, 
    calls, 
    messages, 
    kb_ops, 
    concurrency_peak
  )
  VALUES (p_org_id, p_period, p_minutes, p_calls, p_messages, p_kb_ops, p_concurrency_peak)
  ON CONFLICT (organization_id, year_month)
  DO UPDATE SET
    minutes = usage_rollups.minutes + EXCLUDED.minutes,
    calls = usage_rollups.calls + EXCLUDED.calls,
    messages = usage_rollups.messages + EXCLUDED.messages,
    kb_ops = usage_rollups.kb_ops + EXCLUDED.kb_ops,
    concurrency_peak = GREATEST(usage_rollups.concurrency_peak, EXCLUDED.concurrency_peak),
    updated_at = now();
END;
$$;
