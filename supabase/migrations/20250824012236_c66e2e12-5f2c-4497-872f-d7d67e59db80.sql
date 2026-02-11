-- Create alerts table to store triggered alerts
CREATE TABLE public.alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  title text NOT NULL,
  description text NOT NULL,
  threshold_data jsonb NOT NULL DEFAULT '{}',
  source_events jsonb NOT NULL DEFAULT '[]',
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create alert rules configuration table
CREATE TABLE public.alert_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  description text NOT NULL,
  conditions jsonb NOT NULL,
  threshold_count integer NOT NULL,
  time_window_minutes integer NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, rule_name)
);

-- Enable RLS for alerts table
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for alerts
CREATE POLICY "Org admins can manage alerts" 
  ON public.alerts FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = alerts.organization_id AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = alerts.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role
        AND seat_active = true
    )
  );

-- Enable RLS for alert_rules table  
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for alert_rules
CREATE POLICY "Org admins can manage alert rules" 
  ON public.alert_rules FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = alert_rules.organization_id AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = alert_rules.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role
        AND seat_active = true
    )
  );

-- Create function to seed default alert rules for an organization
CREATE OR REPLACE FUNCTION public.seed_default_alert_rules(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Role changes rule
  INSERT INTO public.alert_rules (organization_id, rule_name, description, conditions, threshold_count, time_window_minutes, severity)
  VALUES (
    p_org_id,
    'rapid_role_changes',
    'Multiple role changes in short time period',
    jsonb_build_object('actions', ARRAY['member.role_changed'], 'target_types', ARRAY['member']),
    5,
    10,
    'high'
  ) ON CONFLICT (organization_id, rule_name) DO NOTHING;

  -- Failed invite acceptances rule
  INSERT INTO public.alert_rules (organization_id, rule_name, description, conditions, threshold_count, time_window_minutes, severity)
  VALUES (
    p_org_id,
    'failed_invite_acceptances',
    'Multiple failed invite acceptances',
    jsonb_build_object('actions', ARRAY['invite.accept_failed'], 'status', 'error'),
    10,
    5,
    'medium'
  ) ON CONFLICT (organization_id, rule_name) DO NOTHING;

  -- Billing payment failures rule
  INSERT INTO public.alert_rules (organization_id, rule_name, description, conditions, threshold_count, time_window_minutes, severity)
  VALUES (
    p_org_id,
    'billing_payment_failures',
    'Multiple billing payment failures',
    jsonb_build_object('actions', ARRAY['billing.payment_failed'], 'target_types', ARRAY['payment']),
    3,
    1440, -- 24 hours
    'critical'
  ) ON CONFLICT (organization_id, rule_name) DO NOTHING;

  -- RLS authorization failures rule
  INSERT INTO public.alert_rules (organization_id, rule_name, description, conditions, threshold_count, time_window_minutes, severity)
  VALUES (
    p_org_id,
    'rls_authorization_failures',
    'Repeated RLS authorization failures by same user',
    jsonb_build_object('error_codes', ARRAY['not_authorized'], 'status', 'error'),
    5,
    15,
    'high'
  ) ON CONFLICT (organization_id, rule_name) DO NOTHING;
END;
$$;

-- Create function to check alert rules and trigger alerts
CREATE OR REPLACE FUNCTION public.check_alert_rules(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule_record RECORD;
  event_count INTEGER;
  source_events JSONB;
  alert_id UUID;
  results JSONB = '[]'::jsonb;
  cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Process each enabled alert rule for the organization
  FOR rule_record IN 
    SELECT * FROM public.alert_rules 
    WHERE organization_id = p_org_id AND is_enabled = true
  LOOP
    -- Calculate time cutoff
    cutoff_time := now() - (rule_record.time_window_minutes || ' minutes')::interval;
    
    -- Check different rule types
    CASE rule_record.rule_name
      WHEN 'rapid_role_changes' THEN
        -- Count role changes in time window
        SELECT COUNT(*), json_agg(
          json_build_object(
            'id', id,
            'action', action,
            'target_id', target_id,
            'actor_user_id', actor_user_id,
            'created_at', created_at,
            'metadata', metadata
          )
        ) INTO event_count, source_events
        FROM public.activity_logs
        WHERE organization_id = p_org_id
          AND action = 'member.role_changed'
          AND target_type = 'member'
          AND created_at >= cutoff_time;
          
      WHEN 'failed_invite_acceptances' THEN
        -- Count failed invite acceptances
        SELECT COUNT(*), json_agg(
          json_build_object(
            'id', id,
            'action', action,
            'target_id', target_id,
            'actor_user_id', actor_user_id,
            'created_at', created_at,
            'error_code', error_code
          )
        ) INTO event_count, source_events
        FROM public.activity_logs
        WHERE organization_id = p_org_id
          AND action = 'invite.accept_failed'
          AND status = 'error'
          AND created_at >= cutoff_time;
          
      WHEN 'billing_payment_failures' THEN
        -- Count billing payment failures
        SELECT COUNT(*), json_agg(
          json_build_object(
            'id', id,
            'action', action,
            'target_id', target_id,
            'created_at', created_at,
            'metadata', metadata
          )
        ) INTO event_count, source_events
        FROM public.activity_logs
        WHERE organization_id = p_org_id
          AND action = 'billing.payment_failed'
          AND target_type = 'payment'
          AND created_at >= cutoff_time;
          
      WHEN 'rls_authorization_failures' THEN
        -- Count RLS authorization failures by same user
        SELECT COUNT(*), json_agg(
          json_build_object(
            'id', id,
            'action', action,
            'actor_user_id', actor_user_id,
            'error_code', error_code,
            'created_at', created_at,
            'metadata', metadata
          )
        ) INTO event_count, source_events
        FROM public.activity_logs
        WHERE organization_id = p_org_id
          AND error_code = 'not_authorized'
          AND status = 'error'
          AND created_at >= cutoff_time
          AND actor_user_id IS NOT NULL;
    END CASE;
    
    -- Check if threshold is exceeded
    IF event_count >= rule_record.threshold_count THEN
      -- Check if we already have an active alert for this rule
      IF NOT EXISTS (
        SELECT 1 FROM public.alerts 
        WHERE organization_id = p_org_id 
          AND rule_name = rule_record.rule_name 
          AND status = 'active'
          AND created_at >= cutoff_time
      ) THEN
        -- Create new alert
        INSERT INTO public.alerts (
          organization_id,
          rule_name,
          severity,
          title,
          description,
          threshold_data,
          source_events
        ) VALUES (
          p_org_id,
          rule_record.rule_name,
          rule_record.severity,
          CASE rule_record.rule_name
            WHEN 'rapid_role_changes' THEN format('Rapid Role Changes Detected (%s events)', event_count)
            WHEN 'failed_invite_acceptances' THEN format('Multiple Failed Invite Acceptances (%s attempts)', event_count)
            WHEN 'billing_payment_failures' THEN format('Billing Payment Failures (%s failures)', event_count)
            WHEN 'rls_authorization_failures' THEN format('Repeated Authorization Failures (%s attempts)', event_count)
            ELSE format('Alert: %s (%s events)', rule_record.rule_name, event_count)
          END,
          rule_record.description,
          jsonb_build_object(
            'event_count', event_count,
            'threshold', rule_record.threshold_count,
            'time_window_minutes', rule_record.time_window_minutes,
            'rule_id', rule_record.id
          ),
          COALESCE(source_events, '[]'::jsonb)
        ) RETURNING id INTO alert_id;
        
        -- Log the alert trigger as an internal event
        INSERT INTO public.activity_logs (
          organization_id,
          action,
          target_type,
          target_id,
          status,
          channel,
          metadata
        ) VALUES (
          p_org_id,
          'alert.triggered',
          'alert',
          alert_id::text,
          'success',
          'internal',
          jsonb_build_object(
            'alert_id', alert_id,
            'rule_name', rule_record.rule_name,
            'severity', rule_record.severity,
            'event_count', event_count,
            'threshold', rule_record.threshold_count
          )
        );
        
        -- Add to results
        results := results || jsonb_build_object(
          'alert_id', alert_id,
          'rule_name', rule_record.rule_name,
          'severity', rule_record.severity,
          'event_count', event_count,
          'threshold', rule_record.threshold_count
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('triggered_alerts', results);
END;
$$;

-- Create updated_at trigger for alerts
CREATE OR REPLACE FUNCTION public.update_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_alerts_updated_at ON public.alerts;
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerts_updated_at();

-- Create updated_at trigger for alert_rules
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON public.alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alerts_updated_at();
