-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update organization" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Org admins can manage memberships" ON public.memberships;
DROP POLICY IF EXISTS "Users can create memberships" ON public.memberships;

DROP POLICY IF EXISTS "Org members can view leads" ON public.leads;
DROP POLICY IF EXISTS "Org members can manage leads" ON public.leads;

DROP POLICY IF EXISTS "Org members can view calls" ON public.calls;
DROP POLICY IF EXISTS "Org members can manage calls" ON public.calls;

DROP POLICY IF EXISTS "Org members can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Org members can manage appointments" ON public.appointments;

DROP POLICY IF EXISTS "Org members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Org members can manage messages" ON public.messages;

DROP POLICY IF EXISTS "Org admins can view usage_events" ON public.usage_events;
DROP POLICY IF EXISTS "Org members can create usage_events" ON public.usage_events;

DROP POLICY IF EXISTS "Org members can view kb_files" ON public.kb_files;
DROP POLICY IF EXISTS "Org members can manage kb_files" ON public.kb_files;

DROP POLICY IF EXISTS "Org members can view embeddings" ON public.embeddings;
DROP POLICY IF EXISTS "Org members can manage embeddings" ON public.embeddings;

-- Organizations policies
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
