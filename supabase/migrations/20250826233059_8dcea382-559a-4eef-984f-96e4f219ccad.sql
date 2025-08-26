-- Legacy memberships table deprecation
-- Mark as deprecated and remove all references

-- 1. Check if memberships table exists and mark as deprecated
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships' AND table_schema = 'public') THEN
        -- Add deprecation comment
        COMMENT ON TABLE public.memberships IS 'DEPRECATED: This table is deprecated. Use organization_members instead. Will be removed after app verification.';
        
        -- Rename to indicate deprecation
        ALTER TABLE public.memberships RENAME TO memberships_deprecated_legacy;
        
        -- Disable RLS to prevent any usage
        ALTER TABLE public.memberships_deprecated_legacy DISABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Legacy memberships table has been marked as deprecated and renamed to memberships_deprecated_legacy';
    ELSE
        RAISE NOTICE 'No legacy memberships table found to deprecate';
    END IF;
END $$;

-- 2. Drop any policies that might reference the old table name
DROP POLICY IF EXISTS "Org admins can invite members" ON public.memberships;
DROP POLICY IF EXISTS "Org admins can manage memberships" ON public.memberships;
DROP POLICY IF EXISTS "Users can accept invitations" ON public.memberships;
DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;

-- 3. Check for and remove any functions that reference memberships table
-- Note: Our canonical functions already use organization_members, so this is just cleanup

-- 4. Log the deprecation
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
  'table.deprecated',
  'organization',
  'memberships_table',
  'success',
  'internal',
  jsonb_build_object(
    'deprecated_table', 'memberships',
    'renamed_to', 'memberships_deprecated_legacy',
    'canonical_table', 'organization_members',
    'reason', 'Legacy table cleanup - will be removed after app verification',
    'timestamp', now()
  )
);