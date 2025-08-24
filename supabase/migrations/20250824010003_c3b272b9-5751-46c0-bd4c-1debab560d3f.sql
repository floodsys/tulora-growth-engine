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
SET search_path TO 'public'
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
SET search_path TO 'public'
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