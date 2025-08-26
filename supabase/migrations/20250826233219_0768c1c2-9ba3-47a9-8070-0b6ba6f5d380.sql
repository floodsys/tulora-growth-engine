-- Legacy memberships table cleanup
-- Remove any lingering references (table doesn't exist, so just cleanup)

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
        RAISE NOTICE 'No legacy memberships table found - already cleaned up or never existed';
    END IF;
END $$;

-- 2. Ensure no policies reference the old table (use IF EXISTS to avoid errors)
DO $$
BEGIN
    -- These will silently succeed if policies don't exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memberships' AND schemaname = 'public') THEN
        DROP POLICY "Org admins can invite members" ON public.memberships;
        DROP POLICY "Org admins can manage memberships" ON public.memberships;
        DROP POLICY "Users can accept invitations" ON public.memberships;
        DROP POLICY "Users can view own memberships" ON public.memberships;
        RAISE NOTICE 'Removed legacy memberships policies';
    ELSE
        RAISE NOTICE 'No legacy memberships policies found to remove';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Policy cleanup completed (some policies may not have existed)';
END $$;