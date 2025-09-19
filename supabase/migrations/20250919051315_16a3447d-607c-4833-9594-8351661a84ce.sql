-- Add settings field to retell_agents table for DTMF configuration
ALTER TABLE public.retell_agents 
ADD COLUMN settings JSONB DEFAULT '{}';

-- Create index for settings queries
CREATE INDEX idx_retell_agents_settings ON public.retell_agents USING GIN (settings);