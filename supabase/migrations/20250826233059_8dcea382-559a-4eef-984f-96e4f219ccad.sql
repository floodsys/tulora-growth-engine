-- Legacy memberships table deprecation (idempotent)
-- Mark as deprecated and remove all references

-- 1. Check if memberships table exists and handle deprecation
DO $$
BEGIN
    -- First try to drop policies on the old table name (if table still has original name)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships' AND table_schema = 'public') THEN
        -- Try to drop policies before renaming
        BEGIN
            DROP POLICY IF EXISTS "Org admins can invite members" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN
            -- Ignore if table doesn't exist
        END;
        BEGIN
            DROP POLICY IF EXISTS "Org admins can manage memberships" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN
            -- Ignore if table doesn't exist
        END;
        BEGIN
            DROP POLICY IF EXISTS "Users can accept invitations" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN
            -- Ignore if table doesn't exist
        END;
        BEGIN
            DROP POLICY IF EXISTS "Users can view own memberships" ON public.memberships;
        EXCEPTION WHEN undefined_table THEN
            -- Ignore if table doesn't exist
        END;
        
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
        RAISE NOTICE 'No legacy memberships table found to deprecate';
    END IF;
END $$;

-- 2. Log the deprecation (only if at least one organization exists)
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
            'table.deprecated',
            'other',
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
        RAISE NOTICE 'Memberships deprecation logged for org_id: %', v_org_id;
    ELSE
        RAISE NOTICE 'Skipping deprecation log: no organizations exist yet';
    END IF;
END $$;
