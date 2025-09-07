-- Permanently remove Core plan definitions
-- This migration removes all plan configurations with product_line in ('core', 'archived_core')

-- First, let's check what we're about to delete (for logging)
DO $$
DECLARE
    core_count INTEGER;
    archived_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO core_count FROM plan_configs WHERE product_line = 'core';
    SELECT COUNT(*) INTO archived_count FROM plan_configs WHERE product_line = 'archived_core';
    
    RAISE NOTICE 'Found % core plans and % archived_core plans to delete', core_count, archived_count;
END $$;

-- Delete all Core and archived Core plan configurations
DELETE FROM plan_configs 
WHERE product_line IN ('core', 'archived_core');

-- Log the completion
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
    'plan_configs.core_deleted',
    'plan_configs',
    'core_cleanup',
    'success',
    'audit',
    jsonb_build_object(
        'description', 'Permanently deleted all Core and archived_core plan configurations',
        'affected_product_lines', ARRAY['core', 'archived_core'],
        'cleanup_timestamp', now(),
        'migration_context', 'core_plan_removal'
    )
);