-- Drop existing activity_logs table to rebuild with proper schema
DROP TABLE IF EXISTS public.activity_logs CASCADE;

-- Create enhanced activity logs with canonical taxonomy
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core identifiers
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role_snapshot TEXT NOT NULL CHECK (actor_role_snapshot IN ('admin', 'editor', 'viewer', 'user', 'system')),
  
  -- Event classification
  action TEXT NOT NULL, -- e.g. 'invite.created', 'member.role_changed', 'billing.plan_updated'
  target_type TEXT NOT NULL CHECK (target_type IN ('agent', 'member', 'invite', 'org', 'integration', 'subscription', 'api_key', 'file', 'test', 'other')),
  target_id TEXT, -- Flexible identifier for the target resource
  
  -- Event outcome
  status TEXT NOT NULL CHECK (status IN ('success', 'error')) DEFAULT 'success',
  error_code TEXT, -- Optional error classification
  
  -- Privacy-conscious request context
  ip_hash TEXT, -- Short hashed IP (no raw IP stored)
  user_agent TEXT, -- Trimmed user agent string
  request_id TEXT, -- For request tracing
  
  -- Event scope and metadata
  channel TEXT NOT NULL CHECK (channel IN ('audit', 'internal', 'test_invites')) DEFAULT 'audit',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create optimized indexes
CREATE INDEX idx_activity_logs_org_channel_created ON public.activity_logs(organization_id, channel, created_at DESC);
CREATE INDEX idx_activity_logs_actor_created ON public.activity_logs(actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_target ON public.activity_logs(target_type, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_activity_logs_request_id ON public.activity_logs(request_id) WHERE request_id IS NOT NULL;

-- RLS Policies: Customers only see audit channel, admins see audit + some internal
CREATE POLICY "audit_logs_viewable_by_org_members" 
ON public.activity_logs 
FOR SELECT 
USING (
  channel = 'audit' AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = activity_logs.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = activity_logs.organization_id 
        AND user_id = auth.uid() 
        AND seat_active = true
    )
  )
);

CREATE POLICY "internal_logs_viewable_by_org_admins" 
ON public.activity_logs 
FOR SELECT 
USING (
  channel = 'internal' AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = activity_logs.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = activity_logs.organization_id 
        AND user_id = auth.uid() 
        AND role::text = 'admin'
        AND seat_active = true
    )
  )
);

CREATE POLICY "test_logs_viewable_by_org_admins" 
ON public.activity_logs 
FOR SELECT 
USING (
  channel = 'test_invites' AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = activity_logs.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = activity_logs.organization_id 
        AND user_id = auth.uid() 
        AND role::text = 'admin'
        AND seat_active = true
    )
  )
);

CREATE POLICY "activity_logs_can_be_created_by_system" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (true); -- Allow system inserts

-- Enhanced logging function with canonical event structure
CREATE OR REPLACE FUNCTION public.log_activity_event(
  p_org_id UUID,
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_role_snapshot TEXT DEFAULT 'user',
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_code TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT 'audit',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
  final_actor_role TEXT;
BEGIN
  -- Normalize actor role
  final_actor_role := lower(trim(p_actor_role_snapshot));
  IF final_actor_role NOT IN ('admin', 'editor', 'viewer', 'user', 'system') THEN
    final_actor_role := 'user';
  END IF;
  
  -- Insert activity log
  INSERT INTO public.activity_logs (
    organization_id,
    actor_user_id,
    actor_role_snapshot,
    action,
    target_type,
    target_id,
    status,
    error_code,
    ip_hash,
    user_agent,
    request_id,
    channel,
    metadata
  ) VALUES (
    p_org_id,
    p_actor_user_id,
    final_actor_role,
    lower(trim(p_action)),
    lower(trim(p_target_type)),
    p_target_id,
    lower(trim(p_status)),
    p_error_code,
    p_ip_hash,
    p_user_agent,
    p_request_id,
    lower(trim(p_channel)),
    p_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Helper function to get user's current role in organization
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user is org owner
  IF EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = p_org_id AND owner_user_id = p_user_id
  ) THEN
    RETURN 'admin';
  END IF;
  
  -- Check organization member role
  RETURN (
    SELECT role::text 
    FROM public.organization_members 
    WHERE organization_id = p_org_id 
      AND user_id = p_user_id 
      AND seat_active = true
    LIMIT 1
  );
END;
$function$;

-- Function to hash IP addresses consistently (first 8 chars of SHA256)
CREATE OR REPLACE FUNCTION public.hash_ip(ip_address TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $function$
BEGIN
  IF ip_address IS NULL OR ip_address = '' THEN
    RETURN NULL;
  END IF;
  
  -- Return first 8 characters of SHA256 hash
  RETURN LEFT(encode(digest(ip_address, 'sha256'), 'hex'), 8);
END;
$function$;

-- Function to trim user agent to essential info (first 100 chars, remove sensitive tokens)
CREATE OR REPLACE FUNCTION public.trim_user_agent(user_agent_string TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $function$
DECLARE
  trimmed TEXT;
BEGIN
  IF user_agent_string IS NULL OR user_agent_string = '' THEN
    RETURN NULL;
  END IF;
  
  -- Take first 100 characters and remove potentially sensitive tokens
  trimmed := LEFT(user_agent_string, 100);
  
  -- Remove common sensitive patterns (tokens, session IDs, etc.)
  trimmed := regexp_replace(trimmed, '\b[a-zA-Z0-9]{20,}\b', '[TOKEN]', 'g');
  trimmed := regexp_replace(trimmed, 'Bearer\s+[^\s]+', 'Bearer [TOKEN]', 'gi');
  
  RETURN trimmed;
END;
$function$;