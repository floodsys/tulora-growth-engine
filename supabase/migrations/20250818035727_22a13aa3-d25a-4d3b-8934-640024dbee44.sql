-- Create agent_profiles table
CREATE TABLE public.agent_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  retell_agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  first_message_mode TEXT NOT NULL DEFAULT 'assistant_speaks' CHECK (first_message_mode IN ('assistant_speaks', 'assistant_waits', 'model_generated')),
  first_message TEXT,
  system_prompt TEXT,
  voice TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
  max_tokens INTEGER DEFAULT 1000,
  call_recording_enabled BOOLEAN NOT NULL DEFAULT true,
  warm_transfer_enabled BOOLEAN NOT NULL DEFAULT false,
  transfer_number TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Org members can view agent profiles" 
ON public.agent_profiles 
FOR SELECT 
USING (is_org_member(organization_id));

CREATE POLICY "Org members can manage agent profiles" 
ON public.agent_profiles 
FOR ALL 
USING (is_org_member(organization_id));

-- Create trigger for updated_at
CREATE TRIGGER update_agent_profiles_updated_at
BEFORE UPDATE ON public.agent_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to ensure only one default agent per org
CREATE OR REPLACE FUNCTION public.ensure_single_default_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this agent as default, unset all other defaults for this org
  IF NEW.is_default = true THEN
    UPDATE public.agent_profiles 
    SET is_default = false 
    WHERE organization_id = NEW.organization_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_agent_trigger
AFTER UPDATE OF is_default ON public.agent_profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_agent();

-- Create updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;