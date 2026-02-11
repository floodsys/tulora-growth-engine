-- Create retell_calls table for production call data
CREATE TABLE public.retell_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE, -- Retell call ID
  organization_id UUID NOT NULL,
  agent_id TEXT, -- Retell agent ID
  direction TEXT NOT NULL, -- 'inbound' or 'outbound'
  to_e164 TEXT NOT NULL,
  from_e164 TEXT NOT NULL,
  status TEXT NOT NULL, -- 'started', 'ongoing', 'completed', 'failed', 'canceled'
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  recording_signed_url TEXT,
  transcript_summary TEXT,
  analysis_json JSONB DEFAULT '{}',
  outcome TEXT, -- Analysis outcome: 'positive', 'negative', 'neutral', 'unknown'
  sentiment TEXT, -- Analysis sentiment: 'positive', 'negative', 'neutral', 'mixed'
  lead_score INTEGER, -- Lead score 0-100
  topics TEXT[], -- Extracted topics/keywords
  owner_user_id UUID, -- User who initiated the call (for outbound)
  tags TEXT[] DEFAULT '{}',
  raw_webhook_data JSONB, -- Store raw webhook for debugging
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_direction CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT valid_status CHECK (status IN ('started', 'ongoing', 'completed', 'failed', 'canceled')),
  CONSTRAINT valid_outcome CHECK (outcome IS NULL OR outcome IN ('positive', 'negative', 'neutral', 'unknown')),
  CONSTRAINT valid_sentiment CHECK (sentiment IS NULL OR sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  CONSTRAINT valid_lead_score CHECK (lead_score IS NULL OR (lead_score >= 0 AND lead_score <= 100)),
  CONSTRAINT valid_phone_numbers CHECK (
    to_e164 ~ '^\+[1-9]\d{1,14}$' AND 
    from_e164 ~ '^\+[1-9]\d{1,14}$'
  )
);

-- Enable RLS
ALTER TABLE public.retell_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Org members can view retell_calls" ON public.retell_calls;
CREATE POLICY "Org members can view retell_calls" 
ON public.retell_calls 
FOR SELECT 
USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "Org members can manage retell_calls" ON public.retell_calls;
CREATE POLICY "Org members can manage retell_calls" 
ON public.retell_calls 
FOR ALL 
USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "retell_calls_insert_active_only" ON public.retell_calls;
CREATE POLICY "retell_calls_insert_active_only" 
ON public.retell_calls 
FOR INSERT 
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

DROP POLICY IF EXISTS "retell_calls_update_active_only" ON public.retell_calls;
CREATE POLICY "retell_calls_update_active_only" 
ON public.retell_calls 
FOR UPDATE 
USING (is_org_active(organization_id) AND is_org_member(organization_id))
WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_retell_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_retell_calls_updated_at ON public.retell_calls;
CREATE TRIGGER update_retell_calls_updated_at
  BEFORE UPDATE ON public.retell_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retell_calls_updated_at();

-- Create indexes for performance
CREATE INDEX idx_retell_calls_org_id ON public.retell_calls(organization_id);
CREATE INDEX idx_retell_calls_call_id ON public.retell_calls(call_id);
CREATE INDEX idx_retell_calls_status ON public.retell_calls(status);
CREATE INDEX idx_retell_calls_started_at ON public.retell_calls(started_at DESC);
CREATE INDEX idx_retell_calls_agent_id ON public.retell_calls(agent_id);
CREATE INDEX idx_retell_calls_direction ON public.retell_calls(direction);
CREATE INDEX idx_retell_calls_outcome ON public.retell_calls(outcome);

-- Create storage bucket for call recordings (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings', 
  false, -- Private bucket for security
  52428800, -- 50MB limit
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for call recordings
DROP POLICY IF EXISTS "Org members can view call recordings" ON storage.objects;
CREATE POLICY "Org members can view call recordings" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'call-recordings' AND 
  EXISTS (
    SELECT 1 FROM public.retell_calls rc 
    WHERE rc.call_id = (storage.foldername(name))[1] 
    AND is_org_member(rc.organization_id)
  )
);

DROP POLICY IF EXISTS "System can upload call recordings" ON storage.objects;
CREATE POLICY "System can upload call recordings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'call-recordings' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "System can update call recordings" ON storage.objects;
CREATE POLICY "System can update call recordings" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'call-recordings' AND auth.role() = 'service_role');
