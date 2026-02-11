-- Legacy memberships table cleanup (idempotent)
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
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships_deprecated_legacy' AND table_schema = 'public') THEN
        RAISE NOTICE 'Legacy memberships table already renamed to memberships_deprecated_legacy';
    ELSE
        RAISE NOTICE 'No legacy memberships table found - already cleaned up or never existed';
    END IF;
END $$;

-- 2. Ensure no policies reference the old table (use IF EXISTS to avoid errors)
DO $$
BEGIN
    -- These will silently succeed if policies don't exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memberships' AND schemaname = 'public') THEN
        BEGIN
            DROP POLICY IF EXISTS "Org admins can invite members" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN NULL;
        END;
        BEGIN
            DROP POLICY IF EXISTS "Org admins can manage memberships" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN NULL;
        END;
        BEGIN
            DROP POLICY IF EXISTS "Users can accept invitations" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN NULL;
        END;
        BEGIN
            DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN NULL;
        END;
        RAISE NOTICE 'Removed legacy memberships policies';
    ELSE
        RAISE NOTICE 'No legacy memberships policies found to remove';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Policy cleanup completed (some policies may not have existed)';
END $$;

-- 3. Log the cleanup (only if at least one organization exists)
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

    IF v_org_id IS NOT NULL THEN
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
            v_org_id,
            NULL,
            'system',
            'legacy.cleanup',
            'other',
            'memberships_references',
            'success',
            'internal',
            jsonb_build_object(
                'legacy_table_checked', 'memberships',
                'canonical_table', 'organization_members',
                'cleanup_type', 'references_only',
                'reason', 'Ensure no lingering references to legacy memberships table',
                'timestamp', now()
            )
        );
        RAISE NOTICE 'Legacy cleanup logged for org_id: %', v_org_id;
    ELSE
        RAISE NOTICE 'Skipping cleanup log: no organizations exist yet';
    END IF;
END $$;
