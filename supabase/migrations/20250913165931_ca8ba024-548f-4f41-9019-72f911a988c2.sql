-- Create usage_rollups table for aggregated monthly usage data
CREATE TABLE public.usage_rollups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  year_month TEXT NOT NULL, -- Format: 'YYYY-MM'
  minutes INTEGER NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  kb_ops INTEGER NOT NULL DEFAULT 0,
  concurrency_peak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, year_month)
);

-- Enable RLS on usage_rollups
ALTER TABLE public.usage_rollups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for usage_rollups
DROP POLICY IF EXISTS "Org admins can view usage_rollups" ON public.usage_rollups;
CREATE POLICY "Org admins can view usage_rollups" ON public.usage_rollups
  FOR SELECT USING (is_org_admin(organization_id));

DROP POLICY IF EXISTS "System can manage usage_rollups" ON public.usage_rollups;
CREATE POLICY "System can manage usage_rollups" ON public.usage_rollups
  FOR ALL USING (false);

-- Create updated_at trigger for usage_rollups
CREATE OR REPLACE FUNCTION public.update_usage_rollups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_usage_rollups_updated_at ON public.usage_rollups;
CREATE TRIGGER update_usage_rollups_updated_at
  BEFORE UPDATE ON public.usage_rollups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_usage_rollups_updated_at();

-- Update usage_events table to improve structure if needed
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS concurrency_level INTEGER DEFAULT 0;

-- Create function to get current concurrency for an organization
CREATE OR REPLACE FUNCTION public.get_current_concurrency(p_org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_calls INTEGER;
BEGIN
  -- Count ongoing calls for the organization
  SELECT COUNT(*) INTO current_calls
  FROM public.retell_calls
  WHERE organization_id = p_org_id
    AND status IN ('started', 'ongoing')
    AND started_at IS NOT NULL
    AND (ended_at IS NULL OR ended_at > now() - interval '5 minutes');
  
  RETURN COALESCE(current_calls, 0);
END;
$$;

-- Create function to aggregate usage data into rollups
CREATE OR REPLACE FUNCTION public.aggregate_usage_rollup(p_org_id UUID, p_year_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
  total_minutes INTEGER := 0;
  total_calls INTEGER := 0;
  total_messages INTEGER := 0;
  total_kb_ops INTEGER := 0;
  peak_concurrency INTEGER := 0;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Parse year_month and calculate date range
  start_date := (p_year_month || '-01')::DATE;
  end_date := start_date + interval '1 month' - interval '1 day';
  
  -- Aggregate retell_calls data
  SELECT 
    COALESCE(SUM(GREATEST(0, duration_ms / 60000)), 0)::INTEGER, -- Convert ms to minutes
    COUNT(*)
  INTO total_minutes, total_calls
  FROM public.retell_calls
  WHERE organization_id = p_org_id
    AND started_at >= start_date
    AND started_at <= end_date + interval '1 day'
    AND status = 'completed';
  
  -- Get peak concurrency from usage_events
  SELECT COALESCE(MAX(concurrency_level), 0) INTO peak_concurrency
  FROM public.usage_events
  WHERE organization_id = p_org_id
    AND event_type = 'concurrency_peak'
    AND created_at >= start_date
    AND created_at <= end_date + interval '1 day';
  
  -- Count knowledge base operations
  SELECT COUNT(*) INTO total_kb_ops
  FROM public.usage_events
  WHERE organization_id = p_org_id
    AND event_type LIKE 'kb_%'
    AND created_at >= start_date
    AND created_at <= end_date + interval '1 day';
  
  -- Upsert into usage_rollups
  INSERT INTO public.usage_rollups (
    organization_id,
    year_month,
    minutes,
    calls,
    messages,
    kb_ops,
    concurrency_peak
  ) VALUES (
    p_org_id,
    p_year_month,
    total_minutes,
    total_calls,
    total_messages,
    total_kb_ops,
    peak_concurrency
  )
  ON CONFLICT (organization_id, year_month)
  DO UPDATE SET
    minutes = EXCLUDED.minutes,
    calls = EXCLUDED.calls,
    messages = EXCLUDED.messages,
    kb_ops = EXCLUDED.kb_ops,
    concurrency_peak = GREATEST(usage_rollups.concurrency_peak, EXCLUDED.concurrency_peak),
    updated_at = now();
  
  result := jsonb_build_object(
    'organization_id', p_org_id,
    'year_month', p_year_month,
    'minutes', total_minutes,
    'calls', total_calls,
    'messages', total_messages,
    'kb_ops', total_kb_ops,
    'concurrency_peak', peak_concurrency
  );
  
  RETURN result;
END;
$$;
