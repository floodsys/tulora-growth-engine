-- Create audit log backfill function
CREATE OR REPLACE FUNCTION public.backfill_audit_logs(
  p_org_id uuid,
  p_dry_run boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_record RECORD;
  member_record RECORD;
  subscription_record RECORD;
  agent_record RECORD;
  events_to_create jsonb[] := '{}';
  events_created integer := 0;
  trace_id text;
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
    RAISE EXCEPTION 'User does not have permission to backfill logs for this organization'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  
  -- Generate trace ID for this backfill operation
  trace_id := 'backfill_' || encode(gen_random_bytes(8), 'hex');
  
  -- Get organization record
  SELECT * INTO org_record 
  FROM public.organizations 
  WHERE id = p_org_id;
  
  IF org_record IS NULL THEN
    RAISE EXCEPTION 'Organization not found'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  
  -- 1. org.created event
  IF NOT EXISTS (
    SELECT 1 FROM public.activity_logs 
    WHERE organization_id = p_org_id 
      AND action = 'org.created' 
      AND target_type = 'org'
  ) THEN
    events_to_create := events_to_create || jsonb_build_object(
      'action', 'org.created',
      'target_type', 'org',
      'target_id', p_org_id::text,
      'actor_user_id', org_record.owner_user_id,
      'actor_role_snapshot', 'admin',
      'metadata', jsonb_build_object(
        'name', org_record.name,
        'owner_user_id', org_record.owner_user_id,
        'backfilled', true
      ),
      'created_at', COALESCE(org_record.created_at, now())
    );
  END IF;
  
  -- 2. member.added events
  FOR member_record IN 
    SELECT om.*, o.owner_user_id
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.organization_id = p_org_id
  LOOP
    -- Check if event already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_logs 
      WHERE organization_id = p_org_id 
        AND action = 'member.added' 
        AND target_type = 'member'
        AND target_id = member_record.user_id::text
    ) THEN
      events_to_create := events_to_create || jsonb_build_object(
        'action', 'member.added',
        'target_type', 'member',
        'target_id', member_record.user_id::text,
        'actor_user_id', CASE 
          WHEN member_record.user_id = member_record.owner_user_id THEN member_record.owner_user_id
          ELSE member_record.owner_user_id
        END,
        'actor_role_snapshot', 'admin',
        'metadata', jsonb_build_object(
          'role', member_record.role::text,
          'seat_active', member_record.seat_active,
          'backfilled', true
        ),
        'created_at', COALESCE(member_record.created_at, now())
      );
    END IF;
    
    -- 3. member.role_set for non-default roles
    IF member_record.role::text != 'viewer' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.activity_logs 
        WHERE organization_id = p_org_id 
          AND action = 'member.role_set' 
          AND target_type = 'member'
          AND target_id = member_record.user_id::text
      ) THEN
        events_to_create := events_to_create || jsonb_build_object(
          'action', 'member.role_set',
          'target_type', 'member',
          'target_id', member_record.user_id::text,
          'actor_user_id', member_record.owner_user_id,
          'actor_role_snapshot', 'admin',
          'metadata', jsonb_build_object(
            'role', member_record.role::text,
            'backfilled', true
          ),
          'created_at', COALESCE(member_record.created_at, now())
        );
      END IF;
    END IF;
  END LOOP;
  
  -- 4. subscription.synced events
  FOR subscription_record IN 
    SELECT * FROM public.org_stripe_subscriptions 
    WHERE organization_id = p_org_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_logs 
      WHERE organization_id = p_org_id 
        AND action = 'subscription.synced' 
        AND target_type = 'subscription'
        AND target_id = subscription_record.id::text
    ) THEN
      events_to_create := events_to_create || jsonb_build_object(
        'action', 'subscription.synced',
        'target_type', 'subscription',
        'target_id', subscription_record.id::text,
        'actor_user_id', NULL,
        'actor_role_snapshot', 'system',
        'metadata', jsonb_build_object(
          'plan_key', subscription_record.plan_key,
          'status', subscription_record.status,
          'quantity', subscription_record.quantity,
          'backfilled', true
        ),
        'created_at', COALESCE(subscription_record.updated_at, subscription_record.created_at, now())
      );
    END IF;
  END LOOP;
  
  -- 5. agent.seeded events
  FOR agent_record IN 
    SELECT * FROM public.agent_profiles 
    WHERE organization_id = p_org_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_logs 
      WHERE organization_id = p_org_id 
        AND action IN ('agent.seeded', 'agent.imported') 
        AND target_type = 'agent'
        AND target_id = agent_record.id::text
    ) THEN
      events_to_create := events_to_create || jsonb_build_object(
        'action', CASE 
          WHEN (agent_record.settings->>'created_by_system')::boolean = true THEN 'agent.seeded'
          ELSE 'agent.imported'
        END,
        'target_type', 'agent',
        'target_id', agent_record.id::text,
        'actor_user_id', org_record.owner_user_id,
        'actor_role_snapshot', 'admin',
        'metadata', jsonb_build_object(
          'status', agent_record.status,
          'name', agent_record.name,
          'is_default', agent_record.is_default,
          'backfilled', true
        ),
        'created_at', COALESCE(agent_record.created_at, now())
      );
    END IF;
  END LOOP;
  
  -- 6. settings.initialized event
  IF NOT EXISTS (
    SELECT 1 FROM public.activity_logs 
    WHERE organization_id = p_org_id 
      AND action = 'settings.initialized' 
      AND target_type = 'org'
  ) THEN
    events_to_create := events_to_create || jsonb_build_object(
      'action', 'settings.initialized',
      'target_type', 'org',
      'target_id', p_org_id::text,
      'actor_user_id', org_record.owner_user_id,
      'actor_role_snapshot', 'admin',
      'metadata', jsonb_build_object(
        'plan_key', org_record.plan_key,
        'billing_status', org_record.billing_status,
        'analytics_enabled', (org_record.analytics_config IS NOT NULL AND org_record.analytics_config != '{}'::jsonb),
        'webhooks_enabled', (org_record.webhook_config IS NOT NULL AND org_record.webhook_config != '{}'::jsonb),
        'retention_configured', (org_record.retention_config IS NOT NULL),
        'backfilled', true
      ),
      'created_at', COALESCE(org_record.created_at, now())
    );
  END IF;
  
  -- Execute the events if not dry run
  IF NOT p_dry_run THEN
    FOR i IN 1..array_length(events_to_create, 1) LOOP
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
        metadata,
        created_at
      ) VALUES (
        p_org_id,
        (events_to_create[i]->>'actor_user_id')::uuid,
        events_to_create[i]->>'actor_role_snapshot',
        events_to_create[i]->>'action',
        events_to_create[i]->>'target_type',
        events_to_create[i]->>'target_id',
        'success',
        NULL,
        NULL,
        NULL,
        trace_id,
        'audit',
        events_to_create[i]->'metadata',
        (events_to_create[i]->>'created_at')::timestamp with time zone
      );
      events_created := events_created + 1;
    END LOOP;
  END IF;
  
  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'dry_run', p_dry_run,
    'trace_id', trace_id,
    'events_planned', array_length(events_to_create, 1),
    'events_created', events_created,
    'events_preview', CASE 
      WHEN array_length(events_to_create, 1) <= 10 THEN events_to_create
      ELSE events_to_create[1:10]
    END
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'organization_id', p_org_id,
      'dry_run', p_dry_run
    );
END;
$$;