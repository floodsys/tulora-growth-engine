-- SECURITY FIX: Enable Row Level Security on memberships_deprecated_legacy table (idempotent)
-- This table was missing RLS despite having policies defined, creating a security vulnerability
-- where user membership data was publicly accessible

-- Only enable RLS if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships_deprecated_legacy' AND table_schema = 'public') THEN
        ALTER TABLE public.memberships_deprecated_legacy ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on memberships_deprecated_legacy table';
    ELSE
        RAISE NOTICE 'Table memberships_deprecated_legacy does not exist - skipping RLS enable';
    END IF;
END $$;

-- Add audit log entry for this security fix (only if at least one organization exists)
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
            'security.rls_enabled',
            'other',
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
        RAISE NOTICE 'Security fix audit logged for org_id: %', v_org_id;
    ELSE
        RAISE NOTICE 'Skipping security fix audit log: no organizations exist yet';
    END IF;
END $$;
