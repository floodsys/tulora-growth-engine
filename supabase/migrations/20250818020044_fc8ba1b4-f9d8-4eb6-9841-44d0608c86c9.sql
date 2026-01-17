-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    settings jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create memberships table
CREATE TABLE IF NOT EXISTS public.memberships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    phone text,
    company text,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    source text,
    notes text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    agent_name text,
    phone_number text,
    duration_seconds integer,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed')),
    recording_url text,
    transcript text,
    summary text,
    sentiment text,
    metadata jsonb DEFAULT '{}',
    started_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    scheduled_at timestamptz NOT NULL,
    duration_minutes integer DEFAULT 30,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    meeting_link text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL,
    sender_type text NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
    sender_name text,
    content text NOT NULL,
    message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'image', 'file')),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Create usage_events table
CREATE TABLE IF NOT EXISTS public.usage_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    resource_type text,
    resource_id uuid,
    quantity integer DEFAULT 1,
    cost_cents integer DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Create kb_files table
CREATE TABLE IF NOT EXISTS public.kb_files (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    file_type text,
    file_size integer,
    storage_path text,
    processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    content_preview text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create embeddings table
CREATE TABLE IF NOT EXISTS public.embeddings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    kb_file_id uuid REFERENCES public.kb_files(id) ON DELETE CASCADE,
    content text NOT NULL,
    embedding vector(1536),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

-- Security definer functions to check organization membership and admin status
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND status = 'active'
  );
$$;

-- Helper function to create organization with owner membership
CREATE OR REPLACE FUNCTION public.create_organization(name text, slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Insert organization
  INSERT INTO public.organizations (name, slug)
  VALUES (name, slug)
  RETURNING id INTO org_id;
  
  -- Add creator as owner
  INSERT INTO public.memberships (organization_id, user_id, role, status)
  VALUES (org_id, auth.uid(), 'owner', 'active');
  
  RETURN org_id;
END;
$$;

-- Organizations policies
DROP POLICY IF EXISTS "Users can view their own organizations" ON public.organizations;
CREATE POLICY "Users can view their own organizations"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id));

CREATE POLICY "Org admins can update organization"
  ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Memberships policies
CREATE POLICY "Users can view own memberships"
  ON public.memberships FOR SELECT
  USING (user_id = auth.uid() OR public.is_org_admin(organization_id));

CREATE POLICY "Org admins can manage memberships"
  ON public.memberships FOR ALL
  USING (public.is_org_admin(organization_id));

CREATE POLICY "Users can create memberships"
  ON public.memberships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Leads policies
CREATE POLICY "Org members can view leads"
  ON public.leads FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org members can manage leads"
  ON public.leads FOR ALL
  USING (public.is_org_member(organization_id));

-- Calls policies
CREATE POLICY "Org members can view calls"
  ON public.calls FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org members can manage calls"
  ON public.calls FOR ALL
  USING (public.is_org_member(organization_id));

-- Appointments policies
CREATE POLICY "Org members can view appointments"
  ON public.appointments FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org members can manage appointments"
  ON public.appointments FOR ALL
  USING (public.is_org_member(organization_id));

-- Messages policies
CREATE POLICY "Org members can view messages"
  ON public.messages FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org members can manage messages"
  ON public.messages FOR ALL
  USING (public.is_org_member(organization_id));

-- Usage events policies
CREATE POLICY "Org admins can view usage_events"
  ON public.usage_events FOR SELECT
  USING (public.is_org_admin(organization_id));

CREATE POLICY "Org members can create usage_events"
  ON public.usage_events FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

-- KB files policies
CREATE POLICY "Org members can view kb_files"
  ON public.kb_files FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org members can manage kb_files"
  ON public.kb_files FOR ALL
  USING (public.is_org_member(organization_id));

-- Embeddings policies
CREATE POLICY "Org members can view embeddings"
  ON public.embeddings FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Org members can manage embeddings"
  ON public.embeddings FOR ALL
  USING (public.is_org_member(organization_id));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON public.memberships(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_status ON public.memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON public.calls(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_org_scheduled ON public.appointments(organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_messages_org_created ON public.messages(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_created ON public.usage_events(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kb_files_org_created ON public.kb_files(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_embeddings_org_file ON public.embeddings(organization_id, kb_file_id);

-- Vector index for embeddings (pgvector)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine 
    ON public.embeddings 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);
  END IF;
END $$;

-- Insert seed data
INSERT INTO public.organizations (name, slug) VALUES 
  ('Demo Organization', 'demo-org')
ON CONFLICT (slug) DO NOTHING;

-- Get the demo org id for seed data
DO $$
DECLARE
  demo_org_id uuid;
BEGIN
  SELECT id INTO demo_org_id FROM public.organizations WHERE slug = 'demo-org';
  
  -- Insert seed leads
  INSERT INTO public.leads (organization_id, name, email, phone, company, status, source) VALUES 
    (demo_org_id, 'John Smith', 'john@example.com', '+1-555-0123', 'Tech Corp', 'new', 'website'),
    (demo_org_id, 'Sarah Johnson', 'sarah@example.com', '+1-555-0124', 'Design Studio', 'contacted', 'referral'),
    (demo_org_id, 'Mike Wilson', 'mike@example.com', '+1-555-0125', 'Marketing Inc', 'qualified', 'linkedin')
  ON CONFLICT DO NOTHING;
  
  -- Insert seed calls
  INSERT INTO public.calls (organization_id, agent_name, phone_number, duration_seconds, status) VALUES 
    (demo_org_id, 'AI Agent Alpha', '+1-555-0100', 180, 'completed'),
    (demo_org_id, 'AI Agent Beta', '+1-555-0101', 240, 'completed'),
    (demo_org_id, 'AI Agent Alpha', '+1-555-0102', 120, 'in_progress')
  ON CONFLICT DO NOTHING;
  
  -- Insert seed appointments
  INSERT INTO public.appointments (organization_id, title, scheduled_at, status) VALUES 
    (demo_org_id, 'Sales Discovery Call', now() + interval '1 day', 'scheduled'),
    (demo_org_id, 'Product Demo', now() + interval '2 days', 'confirmed'),
    (demo_org_id, 'Follow-up Meeting', now() + interval '3 days', 'scheduled')
  ON CONFLICT DO NOTHING;
  
  -- Insert seed usage events
  INSERT INTO public.usage_events (organization_id, event_type, resource_type, quantity, cost_cents) VALUES 
    (demo_org_id, 'api_call', 'voice_synthesis', 45, 450),
    (demo_org_id, 'api_call', 'speech_recognition', 38, 380),
    (demo_org_id, 'storage', 'audio_files', 1024, 50)
  ON CONFLICT DO NOTHING;
END $$;