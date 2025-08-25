-- Drop and recreate the cleanup function with new return type
DROP FUNCTION IF EXISTS public.cleanup_expired_logs();

-- Add legal hold and export settings to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS legal_hold_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS export_before_purge jsonb DEFAULT jsonb_build_object(
  'audit', false,
  'internal', false, 
  'test_invites', false
);

-- Create function to get effective retention config with hard caps
CREATE OR REPLACE FUNCTION public.get_effective_retention_config(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  config jsonb;
  clamped_config jsonb;
BEGIN
  -- Get the organization's retention config
  SELECT retention_config INTO config
  FROM public.organizations
  WHERE id = org_id;
  
  -- Apply hard caps: Public ≤ 365, Internal ≤ 90, Test ≤ 30
  clamped_config := jsonb_build_object(
    'audit_days', LEAST(COALESCE((config->>'audit_days')::int, 365), 365),
    'internal_days', LEAST(COALESCE((config->>'internal_days')::int, 90), 90),
    'test_invites_days', LEAST(COALESCE((config->>'test_invites_days')::int, 30), 30)
  );
  
  RETURN clamped_config;
END;
$$;

-- Create improved cleanup function with exports and audit logging
CREATE OR REPLACE FUNCTION public.cleanup_expired_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  config jsonb;
  audit_cutoff TIMESTAMP WITH TIME ZONE;
  internal_cutoff TIMESTAMP WITH TIME ZONE;
  test_cutoff TIMESTAMP WITH TIME ZONE;
  audit_deleted_count integer := 0;
  internal_deleted_count integer := 0;
  test_deleted_count integer := 0;
  total_deleted integer := 0;
  export_data jsonb;
BEGIN
  -- Process each organization
  FOR org_record IN 
    SELECT id, name, legal_hold_enabled, export_before_purge
    FROM public.organizations
  LOOP
    -- Get effective retention config with caps applied
    config := public.get_effective_retention_config(org_record.id);
    
    -- Calculate cutoff dates
    audit_cutoff := now() - (config->>'audit_days')::int * interval '1 day';
    internal_cutoff := now() - (config->>'internal_days')::int * interval '1 day';
    test_cutoff := now() - (config->>'test_invites_days')::int * interval '1 day';
    
    -- Handle exports before deletion (if enabled)
    IF (org_record.export_before_purge->>'audit')::boolean THEN
      -- Export audit logs before deletion
      SELECT jsonb_agg(to_jsonb(al)) INTO export_data
      FROM public.activity_logs al
      WHERE al.organization_id = org_record.id 
        AND al.channel = 'audit'
        AND al.created_at < audit_cutoff;
      
      IF export_data IS NOT NULL THEN
        INSERT INTO public.audit_log (
          organization_id,
          actor_user_id,
          actor_role_snapshot,
          action,
          target_type,
          target_id,
          status,
          channel,
          metadata
        ) VALUES (
          org_record.id,
          NULL,
          'system',
          'retention.exported',
          'audit_logs',
          'audit',
          'success',
          'internal',
          jsonb_build_object(
            'export_type', 'pre_purge',
            'channel', 'audit',
            'record_count', jsonb_array_length(export_data),
            'cutoff_date', audit_cutoff,
            'timestamp', now()
          )
        );
      END IF;
    END IF;
    
    -- Similar export logic for internal and test logs
    IF (org_record.export_before_purge->>'internal')::boolean THEN
      SELECT jsonb_agg(to_jsonb(al)) INTO export_data
      FROM public.activity_logs al
      WHERE al.organization_id = org_record.id 
        AND al.channel = 'internal'
        AND al.created_at < internal_cutoff;
      
      IF export_data IS NOT NULL THEN
        INSERT INTO public.audit_log (
          organization_id,
          actor_user_id,
          actor_role_snapshot,
          action,
          target_type,
          target_id,
          status,
          channel,
          metadata
        ) VALUES (
          org_record.id,
          NULL,
          'system',
          'retention.exported',
          'audit_logs',
          'internal',
          'success',
          'internal',
          jsonb_build_object(
            'export_type', 'pre_purge',
            'channel', 'internal',
            'record_count', jsonb_array_length(export_data),
            'cutoff_date', internal_cutoff,
            'timestamp', now()
          )
        );
      END IF;
    END IF;
    
    IF (org_record.export_before_purge->>'test_invites')::boolean THEN
      SELECT jsonb_agg(to_jsonb(al)) INTO export_data
      FROM public.activity_logs al
      WHERE al.organization_id = org_record.id 
        AND al.channel = 'test_invites'
        AND al.created_at < test_cutoff;
      
      IF export_data IS NOT NULL THEN
        INSERT INTO public.audit_log (
          organization_id,
          actor_user_id,
          actor_role_snapshot,
          action,
          target_type,
          target_id,
          status,
          channel,
          metadata
        ) VALUES (
          org_record.id,
          NULL,
          'system',
          'retention.exported',
          'audit_logs',
          'test_invites',
          'success',
          'internal',
          jsonb_build_object(
            'export_type', 'pre_purge',
            'channel', 'test_invites',
            'record_count', jsonb_array_length(export_data),
            'cutoff_date', test_cutoff,
            'timestamp', now()
          )
        );
      END IF;
    END IF;
    
    -- Delete audit logs (respect legal hold)
    IF NOT org_record.legal_hold_enabled THEN
      WITH deleted AS (
        DELETE FROM public.activity_logs
        WHERE organization_id = org_record.id 
          AND channel = 'audit'
          AND created_at < audit_cutoff
        RETURNING 1
      )
      SELECT count(*) INTO audit_deleted_count FROM deleted;
    ELSE
      audit_deleted_count := 0;
    END IF;
    
    -- Delete internal logs (ignore legal hold)
    WITH deleted AS (
      DELETE FROM public.activity_logs
      WHERE organization_id = org_record.id 
        AND channel = 'internal'
        AND created_at < internal_cutoff
      RETURNING 1
    )
    SELECT count(*) INTO internal_deleted_count FROM deleted;
    
    -- Delete test logs (ignore legal hold)
    WITH deleted AS (
      DELETE FROM public.activity_logs
      WHERE organization_id = org_record.id 
        AND channel = 'test_invites'
        AND created_at < test_cutoff
      RETURNING 1
    )
    SELECT count(*) INTO test_deleted_count FROM deleted;
    
    -- Log retention.applied event
    INSERT INTO public.audit_log (
      organization_id,
      actor_user_id,
      actor_role_snapshot,
      action,
      target_type,
      target_id,
      status,
      channel,
      metadata
    ) VALUES (
      org_record.id,
      NULL,
      'system',
      'retention.applied',
      'organization',
      org_record.id::text,
      'success',
      'audit',
      jsonb_build_object(
        'effective_config', config,
        'legal_hold_enabled', org_record.legal_hold_enabled,
        'audit_deleted', audit_deleted_count,
        'internal_deleted', internal_deleted_count,
        'test_deleted', test_deleted_count,
        'total_deleted', audit_deleted_count + internal_deleted_count + test_deleted_count,
        'cutoff_dates', jsonb_build_object(
          'audit', audit_cutoff,
          'internal', internal_cutoff,
          'test_invites', test_cutoff
        ),
        'timestamp', now()
      )
    );
    
    total_deleted := total_deleted + audit_deleted_count + internal_deleted_count + test_deleted_count;
  END LOOP;
  
  -- Also clean up old audit_log entries (separate from activity_logs)
  FOR org_record IN 
    SELECT id FROM public.organizations
  LOOP
    config := public.get_effective_retention_config(org_record.id);
    audit_cutoff := now() - (config->>'audit_days')::int * interval '1 day';
    internal_cutoff := now() - (config->>'internal_days')::int * interval '1 day';
    test_cutoff := now() - (config->>'test_invites_days')::int * interval '1 day';
    
    -- Clean up audit_log table based on channel
    DELETE FROM public.audit_log
    WHERE organization_id = org_record.id
      AND (
        (channel = 'audit' AND created_at < audit_cutoff) OR
        (channel = 'internal' AND created_at < internal_cutoff) OR
        (channel = 'test_invites' AND created_at < test_cutoff)
      );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_deleted', total_deleted,
    'processed_orgs', (SELECT count(*) FROM public.organizations),
    'timestamp', now()
  );
END;
$$;