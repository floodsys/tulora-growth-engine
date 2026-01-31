-- Create secure RPC for logging events
CREATE OR REPLACE FUNCTION public.log_event(
  p_org_id UUID,
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_role_snapshot TEXT DEFAULT 'user',
  p_action TEXT DEFAULT 'unknown',
  p_target_type TEXT DEFAULT 'unknown',
  p_target_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_code TEXT DEFAULT NULL,
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
  user_role TEXT;
BEGIN
  -- Get current user ID if not provided
  IF p_actor_user_id IS NULL THEN
    p_actor_user_id := auth.uid();
  END IF;
  
  -- Validate organization membership/privilege if user is provided
  IF p_actor_user_id IS NOT NULL THEN
    -- Check if user is org owner or member
    IF NOT (
      EXISTS (
        SELECT 1 FROM public.organizations 
        WHERE id = p_org_id AND owner_user_id = p_actor_user_id
      ) OR EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = p_org_id 
          AND user_id = p_actor_user_id 
          AND seat_active = true
      )
    ) THEN
      RAISE EXCEPTION 'User does not have permission to log events for this organization'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    
    -- Get actual user role if not provided or validate provided role
    user_role := get_user_org_role(p_org_id, p_actor_user_id);
    IF user_role IS NOT NULL THEN
      final_actor_role := user_role;
    ELSE
      final_actor_role := lower(trim(p_actor_role_snapshot));
    END IF;
  ELSE
    final_actor_role := 'system';
  END IF;
  
  -- Normalize actor role
  IF final_actor_role NOT IN ('admin', 'editor', 'viewer', 'user', 'system') THEN
    final_actor_role := 'user';
  END IF;
  
  -- Insert audit log using the existing insert function
  SELECT public.insert_audit_log(
    p_org_id,
    lower(trim(p_action)),
    lower(trim(p_target_type)),
    p_actor_user_id,
    final_actor_role,
    p_target_id,
    lower(trim(p_status)),
    p_error_code,
    NULL, -- ip_hash (handled by edge function)
    NULL, -- user_agent (handled by edge function)
    NULL, -- request_id (handled by edge function)
    lower(trim(p_channel)),
    p_metadata
  ) INTO log_id;
  
  RETURN log_id;
END;
$function$;

-- Create paginated audit log reader
CREATE OR REPLACE FUNCTION public.list_audit_log(
  p_org_id UUID,
  p_filters JSONB DEFAULT '{}',
  p_cursor TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  organization_id UUID,
  actor_user_id UUID,
  actor_role_snapshot TEXT,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  status TEXT,
  error_code TEXT,
  channel TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  has_more BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_query TEXT;
  where_conditions TEXT[] := ARRAY[]::TEXT[];
  final_query TEXT;
  total_returned INTEGER;
BEGIN
  -- Validate organization access (RLS will be applied automatically)
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_org_id AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_org_id 
        AND user_id = auth.uid() 
        AND seat_active = true
    )
  ) THEN
    RAISE EXCEPTION 'User does not have permission to read audit logs for this organization'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Set limit bounds
  p_limit := GREATEST(1, LEAST(p_limit, 100));
  
  -- Base query with organization filter
  base_query := 'SELECT al.id, al.organization_id, al.actor_user_id, al.actor_role_snapshot, 
                        al.action, al.target_type, al.target_id, al.status, al.error_code, 
                        al.channel, al.metadata, al.created_at
                 FROM public.audit_log al 
                 WHERE al.organization_id = $1';
  
  -- Add cursor condition for pagination
  IF p_cursor IS NOT NULL THEN
    where_conditions := array_append(where_conditions, 'al.created_at < $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  -- Add filters
  IF p_filters ? 'action' THEN
    where_conditions := array_append(where_conditions, 'al.action = $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  IF p_filters ? 'actor_user_id' THEN
    where_conditions := array_append(where_conditions, 'al.actor_user_id = $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  IF p_filters ? 'target_type' THEN
    where_conditions := array_append(where_conditions, 'al.target_type = $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  IF p_filters ? 'status' THEN
    where_conditions := array_append(where_conditions, 'al.status = $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  IF p_filters ? 'channel' THEN
    where_conditions := array_append(where_conditions, 'al.channel = $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  IF p_filters ? 'date_from' THEN
    where_conditions := array_append(where_conditions, 'al.created_at >= $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  IF p_filters ? 'date_to' THEN
    where_conditions := array_append(where_conditions, 'al.created_at <= $' || (array_length(where_conditions, 1) + 2)::TEXT);
  END IF;
  
  -- Construct final query
  final_query := base_query;
  IF array_length(where_conditions, 1) > 0 THEN
    final_query := final_query || ' AND ' || array_to_string(where_conditions, ' AND ');
  END IF;
  final_query := final_query || ' ORDER BY al.created_at DESC LIMIT $' || (array_length(where_conditions, 1) + 2)::TEXT;
  
  -- Execute query and return results with pagination info
  RETURN QUERY
  SELECT 
    r.id, r.organization_id, r.actor_user_id, r.actor_role_snapshot,
    r.action, r.target_type, r.target_id, r.status, r.error_code,
    r.channel, r.metadata, r.created_at,
    (row_number() OVER () = p_limit) AS has_more
  FROM (
    SELECT al.id, al.organization_id, al.actor_user_id, al.actor_role_snapshot,
           al.action, al.target_type, al.target_id, al.status, al.error_code,
           al.channel, al.metadata, al.created_at
    FROM public.audit_log al
    WHERE al.organization_id = p_org_id
    AND (p_cursor IS NULL OR al.created_at < p_cursor)
    AND (NOT (p_filters ? 'action') OR al.action = (p_filters->>'action'))
    AND (NOT (p_filters ? 'actor_user_id') OR al.actor_user_id = (p_filters->>'actor_user_id')::UUID)
    AND (NOT (p_filters ? 'target_type') OR al.target_type = (p_filters->>'target_type'))
    AND (NOT (p_filters ? 'status') OR al.status = (p_filters->>'status'))
    AND (NOT (p_filters ? 'channel') OR al.channel = (p_filters->>'channel'))
    AND (NOT (p_filters ? 'date_from') OR al.created_at >= (p_filters->>'date_from')::TIMESTAMP WITH TIME ZONE)
    AND (NOT (p_filters ? 'date_to') OR al.created_at <= (p_filters->>'date_to')::TIMESTAMP WITH TIME ZONE)
    ORDER BY al.created_at DESC
    LIMIT p_limit + 1
  ) r;
END;
$function$;
