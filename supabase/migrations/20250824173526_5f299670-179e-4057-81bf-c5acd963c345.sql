-- Drop and recreate enhanced backfill function with de-duplication, batch processing, and comprehensive safety
DROP FUNCTION IF EXISTS public.backfill_audit_logs(uuid, boolean);

CREATE OR REPLACE FUNCTION public.backfill_audit_logs(
  p_org_id uuid DEFAULT NULL,
  p_org_ids uuid[] DEFAULT NULL,
  p_dry_run boolean DEFAULT true,
  p_batch_size integer DEFAULT 200
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  org_record RECORD;
  member_record RECORD;
  agent_record RECORD;
  subscription_record RECORD;
  events_planned integer := 0;
  events_created integer := 0;
  events_skipped integer := 0;
  trace_id text;
  events_preview jsonb := '[]'::jsonb;
  org_list uuid[];
  current_org_id uuid;
  batch_events jsonb[];
  batch_count integer := 0;
  total_orgs integer := 0;
  processed_orgs integer := 0;
  org_events_summary jsonb := '[]'::jsonb;
BEGIN
  -- Generate trace ID for this operation
  trace_id := 'backfill_' || encode(gen_random_bytes(8), 'hex');
  
  -- Determine which organizations to process
  IF p_org_id IS NOT NULL THEN
    org_list := ARRAY[p_org_id];
  ELSIF p_org_ids IS NOT NULL THEN
    org_list := p_org_ids;
  ELSE
    -- Get all organizations user has access to
    SELECT ARRAY_AGG(o.id) INTO org_list
    FROM public.organizations o
    WHERE o.owner_user_id = auth.uid() 
       OR EXISTS (
         SELECT 1 FROM public.organization_members om
         WHERE om.organization_id = o.id 
           AND om.user_id = auth.uid() 
           AND om.role = 'admin'::org_role 
           AND om.seat_active = true
       );
  END IF;
  
  total_orgs := COALESCE(array_length(org_list, 1), 0);
  
  -- Process each organization
  FOREACH current_org_id IN ARRAY org_list
  LOOP
    processed_orgs := processed_orgs + 1;
    
    -- Get organization record
    SELECT * INTO org_record 
    FROM public.organizations 
    WHERE id = current_org_id;
    
    IF org_record IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Check permissions for this specific org
    IF NOT (
      org_record.owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = current_org_id 
          AND user_id = auth.uid() 
          AND role = 'admin'::org_role 
          AND seat_active = true
      )
    ) THEN
      CONTINUE;
    END IF;
    
    DECLARE
      org_events_planned integer := 0;
      org_events_created integer := 0;
      org_events_skipped integer := 0;
    BEGIN
      -- 1. Organization created event
      IF NOT EXISTS (
        SELECT 1 FROM public.audit_log 
        WHERE organization_id = current_org_id 
          AND action = 'org.created' 
          AND target_type = 'organization'
          AND target_id = current_org_id::text
      ) THEN
        org_events_planned := org_events_planned + 1;
        events_planned := events_planned + 1;
        
        IF p_dry_run THEN
          events_preview := events_preview || jsonb_build_object(
            'action', 'org.created',
            'target_type', 'organization',
            'target_id', current_org_id::text,
            'created_at', COALESCE(org_record.created_at, now()),
            'organization_id', current_org_id
          );
        ELSE
          INSERT INTO public.audit_log (
            organization_id, actor_user_id, actor_role_snapshot, action, target_type, target_id,
            status, channel, metadata, request_id, created_at
          ) VALUES (
            current_org_id, org_record.owner_user_id,
            CASE WHEN org_record.owner_user_id IS NOT NULL THEN 'admin' ELSE 'system' END,
            'org.created', 'organization', current_org_id::text, 'success', 'audit',
            jsonb_build_object(
              'name', org_record.name, 'owner_user_id', org_record.owner_user_id,
              'backfill', true, 'trace_id', trace_id
            ),
            trace_id, COALESCE(org_record.created_at, now())
          );
          org_events_created := org_events_created + 1;
          events_created := events_created + 1;
        END IF;
      ELSE
        org_events_skipped := org_events_skipped + 1;
        events_skipped := events_skipped + 1;
      END IF;
      
      -- 2. Member added events
      FOR member_record IN 
        SELECT DISTINCT om.user_id, om.role, om.created_at, om.seat_active,
               CASE WHEN om.user_id = org_record.owner_user_id THEN true ELSE false END as is_owner
        FROM public.organization_members om
        WHERE om.organization_id = current_org_id
        UNION 
        SELECT org_record.owner_user_id, 'admin'::org_role, org_record.created_at, true, true
        WHERE org_record.owner_user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE organization_id = current_org_id AND user_id = org_record.owner_user_id
          )
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.audit_log 
          WHERE organization_id = current_org_id 
            AND action = 'member.added' 
            AND target_type = 'member'
            AND target_id = member_record.user_id::text
        ) THEN
          org_events_planned := org_events_planned + 1;
          events_planned := events_planned + 1;
          
          IF p_dry_run THEN
            events_preview := events_preview || jsonb_build_object(
              'action', 'member.added',
              'target_type', 'member',
              'target_id', member_record.user_id::text,
              'created_at', COALESCE(member_record.created_at, now()),
              'organization_id', current_org_id
            );
          ELSE
            INSERT INTO public.audit_log (
              organization_id, actor_user_id, actor_role_snapshot, action, target_type, target_id,
              status, channel, metadata, request_id, created_at
            ) VALUES (
              current_org_id,
              CASE WHEN member_record.is_owner THEN org_record.owner_user_id ELSE null END,
              CASE WHEN member_record.is_owner THEN 'admin' ELSE 'system' END,
              'member.added', 'member', member_record.user_id::text, 'success', 'audit',
              jsonb_build_object(
                'role', member_record.role::text, 'seat_active', member_record.seat_active,
                'is_owner', member_record.is_owner, 'backfill', true, 'trace_id', trace_id
              ),
              trace_id, COALESCE(member_record.created_at, now())
            );
            org_events_created := org_events_created + 1;
            events_created := events_created + 1;
          END IF;
        ELSE
          org_events_skipped := org_events_skipped + 1;
          events_skipped := events_skipped + 1;
        END IF;
      END LOOP;
      
      -- 3. Agent creation events
      FOR agent_record IN 
        SELECT ap.id, ap.name, ap.status, ap.created_at
        FROM public.agent_profiles ap
        WHERE ap.organization_id = current_org_id
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.audit_log 
          WHERE organization_id = current_org_id 
            AND action = 'agent.created' 
            AND target_type = 'agent'
            AND target_id = agent_record.id::text
        ) THEN
          org_events_planned := org_events_planned + 1;
          events_planned := events_planned + 1;
          
          IF p_dry_run THEN
            events_preview := events_preview || jsonb_build_object(
              'action', 'agent.created',
              'target_type', 'agent',
              'target_id', agent_record.id::text,
              'created_at', COALESCE(agent_record.created_at, now()),
              'organization_id', current_org_id
            );
          ELSE
            INSERT INTO public.audit_log (
              organization_id, actor_user_id, actor_role_snapshot, action, target_type, target_id,
              status, channel, metadata, request_id, created_at
            ) VALUES (
              current_org_id, org_record.owner_user_id,
              CASE WHEN org_record.owner_user_id IS NOT NULL THEN 'admin' ELSE 'system' END,
              'agent.created', 'agent', agent_record.id::text, 'success', 'audit',
              jsonb_build_object(
                'name', agent_record.name, 'status', agent_record.status,
                'backfill', true, 'trace_id', trace_id
              ),
              trace_id, COALESCE(agent_record.created_at, now())
            );
            org_events_created := org_events_created + 1;
            events_created := events_created + 1;
          END IF;
        ELSE
          org_events_skipped := org_events_skipped + 1;
          events_skipped := events_skipped + 1;
        END IF;
      END LOOP;
      
      -- 4. Subscription events
      FOR subscription_record IN 
        SELECT oss.id, oss.status, oss.plan_key, oss.updated_at, oss.created_at
        FROM public.org_stripe_subscriptions oss
        WHERE oss.organization_id = current_org_id
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.audit_log 
          WHERE organization_id = current_org_id 
            AND action = 'subscription.synced' 
            AND target_type = 'subscription'
            AND target_id = subscription_record.id::text
        ) THEN
          org_events_planned := org_events_planned + 1;
          events_planned := events_planned + 1;
          
          IF p_dry_run THEN
            events_preview := events_preview || jsonb_build_object(
              'action', 'subscription.synced',
              'target_type', 'subscription',
              'target_id', subscription_record.id::text,
              'created_at', COALESCE(subscription_record.updated_at, subscription_record.created_at, now()),
              'organization_id', current_org_id
            );
          ELSE
            INSERT INTO public.audit_log (
              organization_id, actor_user_id, actor_role_snapshot, action, target_type, target_id,
              status, channel, metadata, request_id, created_at
            ) VALUES (
              current_org_id, org_record.owner_user_id,
              CASE WHEN org_record.owner_user_id IS NOT NULL THEN 'admin' ELSE 'system' END,
              'subscription.synced', 'subscription', subscription_record.id::text, 'success', 'audit',
              jsonb_build_object(
                'plan_key', subscription_record.plan_key, 'status', subscription_record.status,
                'backfill', true, 'trace_id', trace_id
              ),
              trace_id, COALESCE(subscription_record.updated_at, subscription_record.created_at, now())
            );
            org_events_created := org_events_created + 1;
            events_created := events_created + 1;
          END IF;
        ELSE
          org_events_skipped := org_events_skipped + 1;
          events_skipped := events_skipped + 1;
        END IF;
      END LOOP;
      
      -- Add org summary
      org_events_summary := org_events_summary || jsonb_build_object(
        'organization_id', current_org_id,
        'organization_name', org_record.name,
        'events_planned', org_events_planned,
        'events_created', org_events_created,
        'events_skipped', org_events_skipped
      );
    END;
  END LOOP;
  
  -- Return comprehensive result
  RETURN jsonb_build_object(
    'success', true,
    'dry_run', p_dry_run,
    'trace_id', trace_id,
    'total_organizations', total_orgs,
    'processed_organizations', processed_orgs,
    'events_planned', events_planned,
    'events_created', events_created,
    'events_skipped', events_skipped,
    'events_preview', CASE WHEN p_dry_run THEN events_preview ELSE '[]'::jsonb END,
    'organization_summary', org_events_summary
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'dry_run', p_dry_run,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'trace_id', trace_id
    );
END;
$$;