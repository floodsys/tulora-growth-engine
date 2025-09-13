-- Create retell_agents table for centralized agent configuration
CREATE TABLE public.retell_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  agent_id TEXT NOT NULL, -- Retell agent ID
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  voice_id TEXT,
  voice_model TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  backchannel_enabled BOOLEAN NOT NULL DEFAULT false,
  backchannel_frequency NUMERIC(3,2) DEFAULT 0.8,
  pronunciation_dict JSONB DEFAULT '{}',
  voice_speed NUMERIC(3,2) DEFAULT 1.0,
  voice_temperature NUMERIC(3,2) DEFAULT 1.0,
  volume NUMERIC(3,2) DEFAULT 1.0,
  normalize_for_speech BOOLEAN NOT NULL DEFAULT true,
  max_call_duration_ms INTEGER DEFAULT 1800000, -- 30 minutes
  end_call_after_silence_ms INTEGER DEFAULT 10000, -- 10 seconds
  begin_message_delay_ms INTEGER DEFAULT 800,
  voicemail_option TEXT DEFAULT 'disabled',
  data_storage_setting TEXT DEFAULT 'standard',
  opt_in_signed_url BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT,
  transfer_number TEXT,
  transfer_mode TEXT DEFAULT 'disabled', -- disabled, warm, cold
  kb_ids TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT unique_org_agent UNIQUE(organization_id, agent_id),
  CONSTRAINT valid_voice_speed CHECK (voice_speed >= 0.5 AND voice_speed <= 2.0),
  CONSTRAINT valid_voice_temperature CHECK (voice_temperature >= 0.0 AND voice_temperature <= 2.0),
  CONSTRAINT valid_volume CHECK (volume >= 0.0 AND volume <= 2.0),
  CONSTRAINT valid_backchannel_frequency CHECK (backchannel_frequency >= 0.0 AND backchannel_frequency <= 1.0),
  CONSTRAINT valid_transfer_mode CHECK (transfer_mode IN ('disabled', 'warm', 'cold')),
  CONSTRAINT valid_voicemail_option CHECK (voicemail_option IN ('disabled', 'enabled')),
  CONSTRAINT valid_data_storage CHECK (data_storage_setting IN ('standard', 'encrypted', 'minimal'))
);

-- Enable RLS
ALTER TABLE public.retell_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Org members can view retell_agents" 
ON public.retell_agents 
FOR SELECT 
USING (is_org_member(organization_id));

CREATE POLICY "Org members can manage retell_agents" 
ON public.retell_agents 
FOR ALL 
USING (is_org_member(organization_id));

CREATE POLICY "retell_agents_insert_active_only" 
ON public.retell_agents 
FOR INSERT 
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

CREATE POLICY "retell_agents_update_active_only" 
ON public.retell_agents 
FOR UPDATE 
USING (is_org_active(organization_id) AND is_org_member(organization_id))
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_retell_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_retell_agents_updated_at
  BEFORE UPDATE ON public.retell_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retell_agents_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_retell_agents_org_id ON public.retell_agents(organization_id);
CREATE INDEX idx_retell_agents_agent_id ON public.retell_agents(agent_id);
CREATE INDEX idx_retell_agents_status ON public.retell_agents(status);

-- Seed some example agents from existing agent_profiles
INSERT INTO public.retell_agents (
  organization_id, 
  agent_id, 
  name, 
  voice_id, 
  language,
  status
)
SELECT 
  ap.organization_id,
  ap.retell_agent_id,
  ap.name,
  ap.voice,
  ap.language,
  CASE WHEN ap.status = 'active' THEN 'published' ELSE 'draft' END
FROM public.agent_profiles ap
WHERE ap.retell_agent_id IS NOT NULL
ON CONFLICT (organization_id, agent_id) DO NOTHING;