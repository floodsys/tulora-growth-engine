-- Add retention configuration to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS retention_config jsonb DEFAULT jsonb_build_object(
  'audit_days', 365,
  'internal_days', 90,
  'test_invites_days', 30
)::jsonb;

-- Create function to generate token fingerprints (last 4 chars + issuer)
CREATE OR REPLACE FUNCTION public.create_token_fingerprint(token_value text, issuer text DEFAULT 'unknown')
RETURNS text
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF token_value IS NULL OR token_value = '' THEN
    RETURN NULL;
  END IF;
  
  -- Return last 4 characters + issuer
  RETURN issuer || ':' || RIGHT(token_value, 4);
END;
$$;

-- Create retention cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  audit_cutoff TIMESTAMP WITH TIME ZONE;
  internal_cutoff TIMESTAMP WITH TIME ZONE;
  test_cutoff TIMESTAMP WITH TIME ZONE;
  deleted_count INTEGER;
BEGIN
  -- Process each organization's retention settings
  FOR org_record IN 
    SELECT id, retention_config
    FROM public.organizations
    WHERE retention_config IS NOT NULL
  LOOP
    -- Calculate cutoff dates based on organization config
    audit_cutoff := now() - ((org_record.retention_config->>'audit_days')::integer || ' days')::interval;
    internal_cutoff := now() - ((org_record.retention_config->>'internal_days')::integer || ' days')::interval;
    test_cutoff := now() - ((org_record.retention_config->>'test_invites_days')::integer || ' days')::interval;
    
    -- Clean up audit logs
    DELETE FROM public.activity_logs
    WHERE organization_id = org_record.id
      AND channel = 'audit'
      AND created_at < audit_cutoff;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE LOG 'Cleaned up % audit logs for organization %', deleted_count, org_record.id;
    END IF;
    
    -- Clean up internal logs
    DELETE FROM public.activity_logs
    WHERE organization_id = org_record.id
      AND channel = 'internal'
      AND created_at < internal_cutoff;
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE LOG 'Cleaned up % internal logs for organization %', deleted_count, org_record.id;
    END IF;
    
    -- Clean up test invite logs
    DELETE FROM public.activity_logs
    WHERE organization_id = org_record.id
      AND channel = 'test_invites'
      AND created_at < test_cutoff;
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE LOG 'Cleaned up % test invite logs for organization %', deleted_count, org_record.id;
    END IF;
  END LOOP;
  
  -- Also clean up audit_log table
  FOR org_record IN 
    SELECT id, retention_config
    FROM public.organizations
    WHERE retention_config IS NOT NULL
  LOOP
    audit_cutoff := now() - ((org_record.retention_config->>'audit_days')::integer || ' days')::interval;
    internal_cutoff := now() - ((org_record.retention_config->>'internal_days')::integer || ' days')::interval;
    test_cutoff := now() - ((org_record.retention_config->>'test_invites_days')::integer || ' days')::interval;
    
    DELETE FROM public.audit_log
    WHERE organization_id = org_record.id
      AND (
        (channel = 'audit' AND created_at < audit_cutoff) OR
        (channel = 'internal' AND created_at < internal_cutoff) OR
        (channel = 'test_invites' AND created_at < test_cutoff)
      );
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE LOG 'Cleaned up % audit_log entries for organization %', deleted_count, org_record.id;
    END IF;
  END LOOP;
END;
$$;

-- Create function to export logs before purge for an organization
CREATE OR REPLACE FUNCTION public.export_logs_before_purge(p_org_id uuid, p_channel text DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  created_at timestamp with time zone,
  channel text,
  action text,
  target_type text,
  target_id text,
  actor_user_id uuid,
  actor_role_snapshot text,
  status text,
  error_code text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  audit_cutoff TIMESTAMP WITH TIME ZONE;
  internal_cutoff TIMESTAMP WITH TIME ZONE;
  test_cutoff TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify caller is org owner or admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = p_org_id AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = p_org_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role
        AND seat_active = true
    )
  ) THEN
    RAISE EXCEPTION 'User does not have permission to export logs for this organization'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Get organization retention config
  SELECT retention_config INTO org_record
  FROM public.organizations
  WHERE id = p_org_id;
  
  IF org_record.retention_config IS NULL THEN
    RAISE EXCEPTION 'No retention configuration found for organization'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  
  -- Calculate cutoff dates
  audit_cutoff := now() - ((org_record.retention_config->>'audit_days')::integer || ' days')::interval;
  internal_cutoff := now() - ((org_record.retention_config->>'internal_days')::integer || ' days')::interval;
  test_cutoff := now() - ((org_record.retention_config->>'test_invites_days')::integer || ' days')::interval;
  
  -- Return logs that would be deleted
  RETURN QUERY
  SELECT al.id, al.created_at, al.channel, al.action, al.target_type, 
         al.target_id, al.actor_user_id, al.actor_role_snapshot, 
         al.status, al.error_code, al.metadata
  FROM public.activity_logs al
  WHERE al.organization_id = p_org_id
    AND (p_channel IS NULL OR al.channel = p_channel)
    AND (
      (al.channel = 'audit' AND al.created_at < audit_cutoff) OR
      (al.channel = 'internal' AND al.created_at < internal_cutoff) OR
      (al.channel = 'test_invites' AND al.created_at < test_cutoff)
    )
  ORDER BY al.created_at DESC;
END;
$$;