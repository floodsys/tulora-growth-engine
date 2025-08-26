-- Fix role mismatch: Ensure org_role enum contains admin and set user to admin
-- This handles enum mismatches and sets correct admin role

-- First, ensure the org_role enum contains all expected values
DO $$ 
BEGIN
    -- Check if 'admin' exists in org_role enum, add if missing
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'org_role')
        AND enumlabel = 'admin'
    ) THEN
        ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'admin';
    END IF;
    
    -- Ensure other common role values exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'org_role')
        AND enumlabel = 'user'
    ) THEN
        ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'user';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'org_role')
        AND enumlabel = 'editor'
    ) THEN
        ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'editor';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'org_role')
        AND enumlabel = 'viewer'
    ) THEN
        ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'viewer';
    END IF;
END $$;

-- Now update/upsert the user's membership to admin role
INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
SELECT 
    o.id as organization_id,
    auth.uid() as user_id,
    'admin'::org_role as role,
    true as seat_active
FROM public.organizations o
WHERE o.owner_user_id = auth.uid()
ON CONFLICT (organization_id, user_id) 
DO UPDATE SET 
    role = 'admin'::org_role,
    seat_active = true;

-- If user doesn't own an org, update their existing membership to admin
UPDATE public.organization_members 
SET 
    role = 'admin'::org_role,
    seat_active = true
WHERE user_id = auth.uid()
  AND NOT EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE owner_user_id = auth.uid()
  );

-- Log the role update
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
  'role_normalization',
  'role.updated_to_admin',
  'membership',
  auth.uid()::text,
  'success',
  'audit',
  jsonb_build_object(
    'reason', 'role_mismatch_fix',
    'new_role', 'admin',
    'seat_active', true,
    'timestamp', now()
  )
FROM public.organization_members om
WHERE om.user_id = auth.uid()
LIMIT 1;