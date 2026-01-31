-- Permanently remove Core plan definitions (idempotent, another duplicate)
-- This migration removes all plan configurations with product_line in ('core', 'archived_core')

-- Delete all Core and archived Core plan configurations
DELETE FROM plan_configs 
WHERE product_line IN ('core', 'archived_core');

-- Log entry (only if at least one organization exists)
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        INSERT INTO audit_log (
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
            'cleanup.core_plans_deleted',
            'other',
            'core_cleanup_v3',
            'success',
            'audit',
            jsonb_build_object(
                'description', 'Permanently deleted all Core and archived_core plan configurations',
                'cleanup_timestamp', now()
            )
        );
        RAISE NOTICE 'Core plan cleanup v3 audit logged for org_id: %', v_org_id;
    ELSE
        RAISE NOTICE 'Skipping core plan cleanup v3 audit log: no organizations exist yet';
    END IF;
END $$;
