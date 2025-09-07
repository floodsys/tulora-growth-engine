-- Permanently remove Core plan definitions
-- This migration removes all plan configurations with product_line in ('core', 'archived_core')

-- Delete all Core and archived Core plan configurations
DELETE FROM plan_configs 
WHERE product_line IN ('core', 'archived_core');

-- Simple log entry using existing target_type
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
    '00000000-0000-0000-0000-000000000000'::uuid,
    NULL,
    'system',
    'cleanup.core_plans_deleted',
    'organization',
    '00000000-0000-0000-0000-000000000000',
    'success',
    'audit',
    jsonb_build_object(
        'description', 'Permanently deleted all Core and archived_core plan configurations',
        'cleanup_timestamp', now()
    )
);