-- SECURITY FIX: Enable Row Level Security on memberships_deprecated_legacy table
-- This table was missing RLS despite having policies defined, creating a security vulnerability
-- where user membership data was publicly accessible

ALTER TABLE public.memberships_deprecated_legacy ENABLE ROW LEVEL SECURITY;

-- Add audit log entry for this security fix
INSERT INTO public.audit_log (
  organization_id,
  actor_user_id,
  actor_role_snapshot,
  action,
  target_type,
  target_id,
  status,
  channel,
  metadata
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  NULL,
  'system',
  'security.rls_enabled',
  'table',
  'memberships_deprecated_legacy',
  'success',
  'audit',
  jsonb_build_object(
    'security_fix', true,
    'issue', 'RLS disabled despite policies existing',
    'impact', 'User membership data was publicly accessible',
    'fix_applied', 'Enabled RLS on table',
    'timestamp', now()
  )
);