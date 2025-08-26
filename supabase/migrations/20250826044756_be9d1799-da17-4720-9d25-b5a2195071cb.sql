-- Reactivate seat for current user
-- This fixes seat_active=false blocking admin access

UPDATE public.organization_members 
SET seat_active = true 
WHERE user_id = auth.uid() 
  AND seat_active = false;

-- Add audit log for the seat reactivation
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
) 
SELECT 
  om.organization_id,
  auth.uid(),
  'self_reactivation',
  'seat.reactivated',
  'seat',
  auth.uid()::text,
  'success',
  'audit',
  jsonb_build_object(
    'reason', 'seat_active_false_blocking_access',
    'previous_state', 'inactive',
    'new_state', 'active',
    'timestamp', now()
  )
FROM public.organization_members om
WHERE om.user_id = auth.uid() AND om.seat_active = true;