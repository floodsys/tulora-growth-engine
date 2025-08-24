-- Create blocked operation tracking table for rate limiting
CREATE TABLE public.blocked_operations_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ip_address INET,
  blocked_count INTEGER NOT NULL DEFAULT 1,
  first_blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('minute', now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index for rate limiting lookups
CREATE UNIQUE INDEX idx_blocked_operations_tracking_org_ip_window 
ON public.blocked_operations_tracking(organization_id, ip_address, window_start);

-- Enable RLS
ALTER TABLE public.blocked_operations_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Only system can manage blocked operations tracking
CREATE POLICY "blocked_operations_tracking_system_only" 
ON public.blocked_operations_tracking 
FOR ALL 
USING (false);

-- Insert default alert rule for blocked operations
INSERT INTO public.alert_rules (
  organization_id,
  rule_name,
  description,
  conditions,
  threshold_count,
  time_window_minutes,
  severity,
  is_enabled
) 
SELECT 
  id as organization_id,
  'blocked_operations_threshold' as rule_name,
  'Triggers when more than 10 blocked operations occur within 5 minutes' as description,
  jsonb_build_object(
    'event_type', 'org.blocked_operation',
    'channel', 'audit',
    'target_type', 'organization'
  ) as conditions,
  10 as threshold_count,
  5 as time_window_minutes,
  'medium' as severity,
  true as is_enabled
FROM public.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.alert_rules 
  WHERE organization_id = organizations.id 
    AND rule_name = 'blocked_operations_threshold'
);

-- Function to track and rate limit blocked operations
CREATE OR REPLACE FUNCTION public.track_blocked_operation(
  p_org_id UUID, 
  p_ip_address INET DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_window TIMESTAMP WITH TIME ZONE;
  current_count INTEGER;
  rate_limit_hit BOOLEAN := false;
  alert_threshold INTEGER := 10;
  result JSONB;
BEGIN
  current_window := date_trunc('minute', now());
  
  -- Upsert blocked operation tracking
  INSERT INTO public.blocked_operations_tracking (
    organization_id, 
    ip_address, 
    window_start,
    blocked_count,
    first_blocked_at,
    last_blocked_at
  ) VALUES (
    p_org_id, 
    p_ip_address, 
    current_window,
    1,
    now(),
    now()
  )
  ON CONFLICT (organization_id, ip_address, window_start)
  DO UPDATE SET 
    blocked_count = blocked_operations_tracking.blocked_count + 1,
    last_blocked_at = now(),
    updated_at = now()
  RETURNING blocked_count INTO current_count;
  
  -- Check if we hit rate limit (more than 50 per minute)
  IF current_count > 50 THEN
    rate_limit_hit := true;
  END IF;
  
  -- Check if we should trigger alert (every 10 operations in 5-minute window)
  IF current_count % alert_threshold = 0 THEN
    -- Check total count in 5-minute window
    SELECT COALESCE(SUM(blocked_count), 0) INTO current_count
    FROM public.blocked_operations_tracking
    WHERE organization_id = p_org_id
      AND window_start >= (current_window - interval '4 minutes')
      AND window_start <= current_window;
    
    -- Trigger alert if threshold exceeded
    IF current_count >= alert_threshold THEN
      INSERT INTO public.alerts (
        organization_id,
        rule_name,
        severity,
        title,
        description,
        status,
        threshold_data,
        source_events
      ) VALUES (
        p_org_id,
        'blocked_operations_threshold',
        'medium',
        'High Volume of Blocked Operations',
        format('Organization has %s blocked operations in the last 5 minutes', current_count),
        'active',
        jsonb_build_object(
          'event_count', current_count,
          'threshold', alert_threshold,
          'time_window_minutes', 5,
          'ip_address', p_ip_address::text
        ),
        jsonb_build_array(
          jsonb_build_object(
            'action', 'org.blocked_operation',
            'count', current_count,
            'time_window', '5 minutes',
            'created_at', now()
          )
        )
      );
      
      -- TODO: Send email notification to org owners/admins
      -- This would typically invoke an edge function to send emails
    END IF;
  END IF;
  
  result := jsonb_build_object(
    'tracked', true,
    'current_count', current_count,
    'rate_limited', rate_limit_hit,
    'window_start', current_window
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the guard if tracking fails
    RETURN jsonb_build_object(
      'tracked', false,
      'error', SQLERRM
    );
END;
$function$;