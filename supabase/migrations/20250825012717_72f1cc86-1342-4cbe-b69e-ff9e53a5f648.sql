-- Create rate limiting infrastructure
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ip_address INET,
  endpoint TEXT NOT NULL,
  action_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('minute', now()),
  last_request_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  exponential_backoff_level INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, ip_address, endpoint, window_start)
);

-- Add RLS policies
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow system to manage rate limits
CREATE POLICY "System can manage rate limits" 
ON public.rate_limits 
FOR ALL 
USING (false);

-- Create rate limit configurations table
CREATE TABLE public.rate_limit_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  max_requests_per_minute INTEGER NOT NULL,
  max_requests_per_hour INTEGER,
  exponential_backoff_base_seconds INTEGER DEFAULT 60,
  max_backoff_seconds INTEGER DEFAULT 3600,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default rate limit configurations
INSERT INTO public.rate_limit_configs (endpoint, max_requests_per_minute, max_requests_per_hour, exponential_backoff_base_seconds) VALUES
-- Sensitive admin operations - very restrictive
('suspend_organization', 10, 50, 60),
('reinstate_organization', 10, 50, 60),
('cancel_organization', 5, 20, 120),
('admin_destructive_action', 5, 25, 120),
('transfer_ownership', 3, 10, 180),
('change_plan', 10, 100, 60),
('revoke_api_key', 15, 100, 30),

-- Authentication operations
('verify_step_up_auth', 20, 200, 30),
('admin_login', 10, 50, 60),
('superadmin_verification', 5, 20, 120),

-- General admin operations
('admin_member_management', 30, 300, 15),
('admin_billing_actions', 20, 200, 30),
('admin_logs_access', 50, 500, 10);

-- Create function to check and enforce rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_endpoint text,
  p_user_id uuid DEFAULT auth.uid(),
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  config_record RECORD;
  current_window timestamptz;
  current_count integer := 0;
  hourly_count integer := 0;
  backoff_until timestamptz;
  backoff_level integer := 0;
  is_blocked boolean := false;
  result jsonb;
BEGIN
  -- Get rate limit configuration
  SELECT * INTO config_record
  FROM public.rate_limit_configs
  WHERE endpoint = p_endpoint AND is_active = true;
  
  IF config_record IS NULL THEN
    -- No rate limit configured, allow request
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_limit_configured');
  END IF;
  
  current_window := date_trunc('minute', now());
  
  -- Get or create rate limit record for current window
  INSERT INTO public.rate_limits (
    user_id, ip_address, endpoint, action_type, window_start
  ) VALUES (
    p_user_id, p_ip_address, p_endpoint, 'admin_action', current_window
  )
  ON CONFLICT (user_id, ip_address, endpoint, window_start) 
  DO UPDATE SET 
    request_count = rate_limits.request_count + 1,
    last_request_at = now(),
    updated_at = now()
  RETURNING request_count, blocked_until, exponential_backoff_level 
  INTO current_count, backoff_until, backoff_level;
  
  -- Check if currently blocked by exponential backoff
  IF backoff_until IS NOT NULL AND backoff_until > now() THEN
    -- Log rate limit violation
    PERFORM public.log_rate_limit_violation(
      p_endpoint, p_user_id, p_ip_address, 'blocked_by_backoff', 
      current_count, config_record.max_requests_per_minute, backoff_level, p_user_agent
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'exponential_backoff',
      'blocked_until', backoff_until,
      'backoff_level', backoff_level,
      'retry_after_seconds', EXTRACT(EPOCH FROM (backoff_until - now()))::integer
    );
  END IF;
  
  -- Check hourly limit if configured
  IF config_record.max_requests_per_hour IS NOT NULL THEN
    SELECT COALESCE(SUM(request_count), 0) INTO hourly_count
    FROM public.rate_limits
    WHERE user_id = p_user_id 
      AND ip_address = p_ip_address 
      AND endpoint = p_endpoint
      AND window_start > (now() - interval '1 hour');
    
    IF hourly_count > config_record.max_requests_per_hour THEN
      -- Apply exponential backoff
      backoff_level := COALESCE(backoff_level, 0) + 1;
      backoff_until := now() + (config_record.exponential_backoff_base_seconds * power(2, backoff_level - 1) || ' seconds')::interval;
      
      -- Cap at max backoff
      IF EXTRACT(EPOCH FROM (backoff_until - now())) > config_record.max_backoff_seconds THEN
        backoff_until := now() + (config_record.max_backoff_seconds || ' seconds')::interval;
      END IF;
      
      -- Update rate limit record with backoff
      UPDATE public.rate_limits 
      SET blocked_until = backoff_until,
          exponential_backoff_level = backoff_level,
          updated_at = now()
      WHERE user_id = p_user_id 
        AND ip_address = p_ip_address 
        AND endpoint = p_endpoint 
        AND window_start = current_window;
      
      PERFORM public.log_rate_limit_violation(
        p_endpoint, p_user_id, p_ip_address, 'hourly_limit_exceeded', 
        hourly_count, config_record.max_requests_per_hour, backoff_level, p_user_agent
      );
      
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'hourly_limit_exceeded',
        'current_count', hourly_count,
        'limit', config_record.max_requests_per_hour,
        'backoff_level', backoff_level,
        'blocked_until', backoff_until,
        'retry_after_seconds', EXTRACT(EPOCH FROM (backoff_until - now()))::integer
      );
    END IF;
  END IF;
  
  -- Check per-minute limit
  IF current_count > config_record.max_requests_per_minute THEN
    -- Apply exponential backoff
    backoff_level := COALESCE(backoff_level, 0) + 1;
    backoff_until := now() + (config_record.exponential_backoff_base_seconds * power(2, backoff_level - 1) || ' seconds')::interval;
    
    -- Cap at max backoff
    IF EXTRACT(EPOCH FROM (backoff_until - now())) > config_record.max_backoff_seconds THEN
      backoff_until := now() + (config_record.max_backoff_seconds || ' seconds')::interval;
    END IF;
    
    -- Update rate limit record with backoff
    UPDATE public.rate_limits 
    SET blocked_until = backoff_until,
        exponential_backoff_level = backoff_level,
        updated_at = now()
    WHERE user_id = p_user_id 
      AND ip_address = p_ip_address 
      AND endpoint = p_endpoint 
      AND window_start = current_window;
    
    PERFORM public.log_rate_limit_violation(
      p_endpoint, p_user_id, p_ip_address, 'minute_limit_exceeded', 
      current_count, config_record.max_requests_per_minute, backoff_level, p_user_agent
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'minute_limit_exceeded',
      'current_count', current_count,
      'limit', config_record.max_requests_per_minute,
      'backoff_level', backoff_level,
      'blocked_until', backoff_until,
      'retry_after_seconds', EXTRACT(EPOCH FROM (backoff_until - now()))::integer
    );
  END IF;
  
  -- Request allowed
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', current_count,
    'limit', config_record.max_requests_per_minute,
    'remaining', config_record.max_requests_per_minute - current_count
  );
END;
$$;

-- Create function to log rate limit violations
CREATE OR REPLACE FUNCTION public.log_rate_limit_violation(
  p_endpoint text,
  p_user_id uuid,
  p_ip_address inet,
  p_violation_type text,
  p_current_count integer,
  p_limit integer,
  p_backoff_level integer,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log (
    organization_id,
    actor_user_id,
    actor_role_snapshot,
    action,
    target_type,
    target_id,
    status,
    error_code,
    channel,
    metadata,
    ip_hash,
    user_agent
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    p_user_id,
    'admin',
    'security.rate_limited',
    'rate_limit',
    p_endpoint,
    'error',
    'rate_limit_exceeded',
    'internal',
    jsonb_build_object(
      'endpoint', p_endpoint,
      'violation_type', p_violation_type,
      'current_count', p_current_count,
      'limit', p_limit,
      'backoff_level', p_backoff_level,
      'ip_address', p_ip_address::text,
      'timestamp', now(),
      'security_event', true,
      'rate_limiting', true
    ),
    substring(encode(sha256(p_ip_address::text::bytea), 'hex'), 1, 8),
    p_user_agent
  );
END;
$$;

-- Create cleanup function for old rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Remove records older than 24 hours that are not blocked
  DELETE FROM public.rate_limits 
  WHERE created_at < (now() - interval '24 hours')
    AND (blocked_until IS NULL OR blocked_until < now());
END;
$$;