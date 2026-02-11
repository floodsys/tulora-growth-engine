-- Create edge function for phone number assignment to agents
-- Add index for better performance on number lookups (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retell_numbers') THEN
    CREATE INDEX IF NOT EXISTS idx_retell_numbers_agent_assignment 
    ON retell_numbers(organization_id, inbound_agent_id, outbound_agent_id) 
    WHERE is_active = true;
  END IF;
END $$;

-- Create edge function for enhanced webhook routing by event type
-- Add webhook event tracking table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  call_id TEXT,
  agent_id TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT fk_webhook_events_organization 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) ON DELETE CASCADE
);

-- Enable RLS on webhook_events
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook_events
DROP POLICY IF EXISTS "Org members can view webhook_events" ON webhook_events;
CREATE POLICY "Org members can view webhook_events" ON webhook_events
  FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "webhook_events_insert_active_only" ON webhook_events;
CREATE POLICY "webhook_events_insert_active_only" ON webhook_events
  FOR INSERT WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- Create index for webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_org_type 
ON webhook_events(organization_id, event_type, created_at);

-- Create widget configuration table for embed generation
CREATE TABLE IF NOT EXISTS widget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  widget_type TEXT NOT NULL DEFAULT 'chat', -- 'chat' or 'callback'
  config_data JSONB NOT NULL DEFAULT '{}',
  public_key TEXT NOT NULL,
  allowed_domains TEXT[] DEFAULT '{}',
  require_recaptcha BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT fk_widget_configs_organization 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id) ON DELETE CASCADE,
    
  UNIQUE(organization_id, agent_id, widget_type)
);

-- Enable RLS on widget_configs
ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for widget_configs
DROP POLICY IF EXISTS "Org members can manage widget_configs" ON widget_configs;
CREATE POLICY "Org members can manage widget_configs" ON widget_configs
  FOR ALL USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "widget_configs_insert_active_only" ON widget_configs;
CREATE POLICY "widget_configs_insert_active_only" ON widget_configs
  FOR INSERT WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- Create trigger for widget_configs updated_at
CREATE OR REPLACE FUNCTION update_widget_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_widget_configs_updated_at ON widget_configs;
CREATE TRIGGER update_widget_configs_updated_at
  BEFORE UPDATE ON widget_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_widget_configs_updated_at();

-- Create index for widget configs
CREATE INDEX IF NOT EXISTS idx_widget_configs_org_agent 
ON widget_configs(organization_id, agent_id) WHERE is_active = true;
