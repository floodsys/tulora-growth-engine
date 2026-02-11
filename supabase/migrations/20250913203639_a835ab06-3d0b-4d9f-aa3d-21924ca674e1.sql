-- Create retell_chats table for chat sessions
CREATE TABLE public.retell_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  chat_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  messages_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create retell_chat_messages table for individual messages
CREATE TABLE public.retell_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.retell_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retell_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for retell_chats
DROP POLICY IF EXISTS "Org members can view retell_chats" ON public.retell_chats;
CREATE POLICY "Org members can view retell_chats" ON public.retell_chats
  FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "Org members can manage retell_chats" ON public.retell_chats;
CREATE POLICY "Org members can manage retell_chats" ON public.retell_chats
  FOR ALL USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "retell_chats_insert_active_only" ON public.retell_chats;
CREATE POLICY "retell_chats_insert_active_only" ON public.retell_chats
  FOR INSERT WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

DROP POLICY IF EXISTS "retell_chats_update_active_only" ON public.retell_chats;
CREATE POLICY "retell_chats_update_active_only" ON public.retell_chats
  FOR UPDATE USING (is_org_active(organization_id) AND is_org_member(organization_id))
  WITH CHECK (is_org_active(organization_id) AND is_org_member(organization_id));

-- Create RLS policies for retell_chat_messages
DROP POLICY IF EXISTS "Chat messages viewable by org members" ON public.retell_chat_messages;
CREATE POLICY "Chat messages viewable by org members" ON public.retell_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.retell_chats rc 
      WHERE rc.chat_id = retell_chat_messages.chat_id 
      AND is_org_member(rc.organization_id)
    )
  );

DROP POLICY IF EXISTS "Chat messages manageable by org members" ON public.retell_chat_messages;
CREATE POLICY "Chat messages manageable by org members" ON public.retell_chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.retell_chats rc 
      WHERE rc.chat_id = retell_chat_messages.chat_id 
      AND is_org_member(rc.organization_id)
    )
  );

-- Create function for retell_chats updated_at trigger (must exist before trigger)
CREATE OR REPLACE FUNCTION public.update_retell_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger (idempotent)
DROP TRIGGER IF EXISTS update_retell_chats_updated_at ON public.retell_chats;
CREATE TRIGGER update_retell_chats_updated_at
  BEFORE UPDATE ON public.retell_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retell_chats_updated_at();

-- Create indexes for performance
CREATE INDEX idx_retell_chats_organization_id ON public.retell_chats(organization_id);
CREATE INDEX idx_retell_chats_chat_id ON public.retell_chats(chat_id);
CREATE INDEX idx_retell_chats_agent_id ON public.retell_chats(agent_id);
CREATE INDEX idx_retell_chat_messages_chat_id ON public.retell_chat_messages(chat_id);
CREATE INDEX idx_retell_chat_messages_created_at ON public.retell_chat_messages(created_at);
