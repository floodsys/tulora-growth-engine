-- Create audit_log table with canonical taxonomy
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core identifiers
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role_snapshot TEXT NOT NULL CHECK (actor_role_snapshot IN ('admin', 'editor', 'viewer', 'user', 'system')),
  
  -- Event classification
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('agent', 'member', 'invite', 'org', 'integration', 'subscription', 'api_key', 'file', 'test', 'other')),
  target_id TEXT,
  
  -- Event outcome
  status TEXT NOT NULL CHECK (status IN ('success', 'error')) DEFAULT 'success',
  error_code TEXT,
  
  -- Privacy-conscious request context
  ip_hash TEXT,
  user_agent TEXT,
  request_id TEXT,
  
  -- Event scope and metadata
  channel TEXT NOT NULL CHECK (channel IN ('audit', 'internal', 'test_invites')) DEFAULT 'audit',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create specified indexes
CREATE INDEX idx_audit_log_org_created ON public.audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_org_action_created ON public.audit_log(organization_id, action, created_at DESC);

-- Additional optimized indexes
CREATE INDEX idx_audit_log_actor_created ON public.audit_log(actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_audit_log_target ON public.audit_log(target_type, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_audit_log_request_id ON public.audit_log(request_id) WHERE request_id IS NOT NULL;

-- RLS Policies (idempotent)

-- INSERT: Only via server-side (security definer RPC)
CREATE POLICY "audit_log_insert_server_only" 
ON public.audit_log 
FOR INSERT 
WITH CHECK (false); -- Block all direct client inserts

-- SELECT: Org members can read audit channel
CREATE POLICY "audit_log_select_org_members_audit" 
ON public.audit_log 
FOR SELECT 
USING (
  channel = 'audit' AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = audit_log.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = audit_log.organization_id 
        AND user_id = auth.uid() 
        AND seat_active = true
    )
  )
);

-- SELECT: Admins/Owners can read audit + internal channels
CREATE POLICY "audit_log_select_admins_internal" 
ON public.audit_log 
FOR SELECT 
USING (
  channel IN ('audit', 'internal') AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = audit_log.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = audit_log.organization_id 
        AND user_id = auth.uid() 
        AND role::text = 'admin'
        AND seat_active = true
    )
  )
);

-- SELECT: test_invites channel - never visible to customers (reserved for superadmin/testing)
-- This policy intentionally excludes regular customers/org members from test_invites channel

-- Server-side insert function for audit logs
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_org_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_role_snapshot TEXT DEFAULT 'user',
  p_target_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_code TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT 'audit',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
  final_actor_role TEXT;
BEGIN
  -- Normalize actor role
  final_actor_role := lower(trim(p_actor_role_snapshot));
  IF final_actor_role NOT IN ('admin', 'editor', 'viewer', 'user', 'system') THEN
    final_actor_role := 'user';
  END IF;
  
  -- Insert audit log (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.audit_log (
    organization_id,
    actor_user_id,
    actor_role_snapshot,
    action,
    target_type,
    target_id,
    status,
    error_code,
    ip_hash,
    user_agent,
    request_id,
    channel,
    metadata
  ) VALUES (
    p_org_id,
    p_actor_user_id,
    final_actor_role,
    lower(trim(p_action)),
    lower(trim(p_target_type)),
    p_target_id,
    lower(trim(p_status)),
    p_error_code,
    p_ip_hash,
    p_user_agent,
    p_request_id,
    lower(trim(p_channel)),
    p_metadata
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;