-- Add webhook and analytics configuration to organizations table
ALTER TABLE public.organizations 
ADD COLUMN webhook_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN analytics_config JSONB DEFAULT '{}'::jsonb;

-- Update the activity logger trigger to call webhooks and analytics
CREATE OR REPLACE FUNCTION public.trigger_external_integrations()
RETURNS TRIGGER AS $$
BEGIN
  -- Call webhook function asynchronously
  PERFORM pg_notify('webhook_event', jsonb_build_object(
    'organization_id', NEW.organization_id,
    'event_id', NEW.id,
    'action', NEW.action,
    'target_type', NEW.target_type,
    'target_id', NEW.target_id,
    'actor_user_id', NEW.actor_user_id,
    'actor_role_snapshot', NEW.actor_role_snapshot,
    'status', NEW.status,
    'channel', NEW.channel,
    'created_at', NEW.created_at,
    'metadata', NEW.metadata
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on audit_log table
DROP TRIGGER IF EXISTS trigger_external_integrations_audit_log ON public.audit_log;
CREATE TRIGGER trigger_external_integrations_audit_log
  AFTER INSERT ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_external_integrations();

-- Create trigger on activity_logs table (for backward compatibility)
DROP TRIGGER IF EXISTS trigger_external_integrations_activity_logs ON public.activity_logs;
CREATE TRIGGER trigger_external_integrations_activity_logs
  AFTER INSERT ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_external_integrations();
