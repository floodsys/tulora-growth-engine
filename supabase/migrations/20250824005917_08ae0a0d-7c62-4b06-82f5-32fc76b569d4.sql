-- Drop existing activity_logs table to rebuild with proper schema
DROP TABLE IF EXISTS public.activity_logs CASCADE;

-- Create enhanced activity logs with canonical taxonomy
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core identifiers
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role_snapshot TEXT NOT NULL CHECK (actor_role_snapshot IN ('admin', 'editor', 'viewer', 'user', 'system')),
  
  -- Event classification
  action TEXT NOT NULL, -- e.g. 'invite.created', 'member.role_changed', 'billing.plan_updated'
  target_type TEXT NOT NULL CHECK (target_type IN ('agent', 'member', 'invite', 'org', 'integration', 'subscription', 'api_key', 'file', 'test', 'other')),
  target_id TEXT, -- Flexible identifier for the target resource
  
  -- Event outcome
  status TEXT NOT NULL CHECK (status IN ('success', 'error')) DEFAULT 'success',
  error_code TEXT, -- Optional error classification
  
  -- Privacy-conscious request context
  ip_hash TEXT, -- Short hashed IP (no raw IP stored)
  user_agent TEXT, -- Trimmed user agent string
  request_id TEXT, -- For request tracing
  
  -- Event scope and metadata
  channel TEXT NOT NULL CHECK (channel IN ('audit', 'internal', 'test_invites')) DEFAULT 'audit',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create optimized indexes
CREATE INDEX idx_activity_logs_org_channel_created ON public.activity_logs(organization_id, channel, created_at DESC);
CREATE INDEX idx_activity_logs_actor_created ON public.activity_logs(actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_target ON public.activity_logs(target_type, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX idx_activity_logs_request_id ON public.activity_logs(request_id) WHERE request_id IS NOT NULL;

-- RLS Policies: Customers only see audit channel, admins see audit + some internal
CREATE POLICY "audit_logs_viewable_by_org_members" 
ON public.activity_logs 
FOR SELECT 
USING (
  channel = 'audit' AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = activity_logs.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = activity_logs.organization_id 
        AND user_id = auth.uid() 
        AND seat_active = true
    )
  )
);

CREATE POLICY "internal_logs_viewable_by_org_admins" 
ON public.activity_logs 
FOR SELECT 
USING (
  channel = 'internal' AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = activity_logs.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = activity_logs.organization_id 
        AND user_id = auth.uid() 
        AND role::text = 'admin'
        AND seat_active = true
    )
  )
);

CREATE POLICY "test_logs_viewable_by_org_admins" 
ON public.activity_logs 
FOR SELECT 
USING (
  channel = 'test_invites' AND (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = activity_logs.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = activity_logs.organization_id 
        AND user_id = auth.uid() 
        AND role::text = 'admin'
        AND seat_active = true
    )
  )
);

CREATE POLICY "activity_logs_can_be_created_by_system" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (true); -- Allow system inserts