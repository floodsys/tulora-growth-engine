-- Schema cleanup and standardization migration
-- Safe, idempotent cleanup of duplicate constraints and legacy tables

-- 1. Clean up duplicate unique constraints on organization_invitations
-- Check for existing constraints first and remove duplicates
DO $$
DECLARE
    constraint_count integer;
BEGIN
    -- Count unique constraints on invite_token
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'organization_invitations' 
      AND tc.constraint_type = 'UNIQUE'
      AND ccu.column_name = 'invite_token';
    
    -- If multiple constraints exist, drop extras and keep one canonical constraint
    IF constraint_count > 1 THEN
        -- Drop any existing constraints on invite_token
        EXECUTE 'ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_invite_token_key';
        EXECUTE 'ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS unique_invite_token';
        EXECUTE 'ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_token_unique';
        EXECUTE 'ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_invite_token_unique';
        
        -- Add single canonical constraint
        EXECUTE 'ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_invite_token_unique UNIQUE (invite_token)';
    ELSIF constraint_count = 0 THEN
        -- Add constraint if none exists
        EXECUTE 'ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_invite_token_unique UNIQUE (invite_token)';
    END IF;
END $$;

-- 2. Clean up duplicate unique constraints on organization_members
DO $$
DECLARE
    constraint_count integer;
BEGIN
    -- Count unique constraints on (organization_id, user_id)
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu1 ON tc.constraint_name = ccu1.constraint_name
    JOIN information_schema.constraint_column_usage ccu2 ON tc.constraint_name = ccu2.constraint_name
    WHERE tc.table_name = 'organization_members' 
      AND tc.constraint_type = 'UNIQUE'
      AND ccu1.column_name = 'organization_id'
      AND ccu2.column_name = 'user_id';
    
    -- If multiple constraints exist, drop extras and keep one canonical constraint
    IF constraint_count > 1 THEN
        -- Drop any existing constraints on (organization_id, user_id)
        EXECUTE 'ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_key';
        EXECUTE 'ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS unique_org_member';
        EXECUTE 'ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_unique';
        EXECUTE 'ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_org_user_unique';
        EXECUTE 'ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_unique';
        
        -- Add single canonical constraint
        EXECUTE 'ALTER TABLE organization_members ADD CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id)';
    ELSIF constraint_count = 0 THEN
        -- Add constraint if none exists
        EXECUTE 'ALTER TABLE organization_members ADD CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id)';
    END IF;
END $$;

-- 3. Standardize subscription tables - make org_stripe_subscriptions canonical
-- Create view for backward compatibility if org_subscriptions is being used
DO $$
BEGIN
    -- Check if both tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_subscriptions') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_stripe_subscriptions') THEN
        
        -- Create backward compatibility view for org_subscriptions
        DROP VIEW IF EXISTS org_subscriptions_legacy;
        CREATE VIEW org_subscriptions_legacy AS
        SELECT 
            id,
            organization_id as org_id,
            stripe_subscription_id,
            plan_key as product_id,
            stripe_subscription_id as price_id,
            stripe_subscription_id as subscription_item_id,
            status,
            quantity,
            current_period_start,
            current_period_end,
            trial_end,
            cancel_at_period_end,
            created_at,
            updated_at
        FROM org_stripe_subscriptions;
        
        -- Add comment for clarity
        COMMENT ON VIEW org_subscriptions_legacy IS 'Backward compatibility view for legacy org_subscriptions table. Use org_stripe_subscriptions directly.';
    END IF;
END $$;

-- 4. Clean up any legacy/unused helper functions that might cause conflicts
-- Keep canonical functions: check_admin_access, check_org_membership, check_org_ownership

-- 5. Ensure RLS helper functions are standardized
-- Add health check functions for admin diagnostics
CREATE OR REPLACE FUNCTION public.get_schema_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    health_data jsonb := '{}';
    table_count integer;
    function_count integer;
    policy_count integer;
    constraint_violations text[];
BEGIN
    -- Count core tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('organizations', 'organization_members', 'organization_invitations', 'org_stripe_subscriptions');
    
    -- Count RLS functions
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('check_admin_access', 'check_org_membership', 'check_org_ownership', 'is_org_admin', 'is_org_member');
    
    -- Count RLS policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('organizations', 'organization_members', 'organization_invitations');
    
    -- Check for constraint violations or missing constraints
    constraint_violations := ARRAY[]::text[];
    
    -- Check organization_invitations unique constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'organization_invitations' 
          AND tc.constraint_type = 'UNIQUE'
          AND ccu.column_name = 'invite_token'
    ) THEN
        constraint_violations := array_append(constraint_violations, 'Missing unique constraint on organization_invitations.invite_token');
    END IF;
    
    -- Check organization_members unique constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu1 ON tc.constraint_name = ccu1.constraint_name
        JOIN information_schema.constraint_column_usage ccu2 ON tc.constraint_name = ccu2.constraint_name
        WHERE tc.table_name = 'organization_members' 
          AND tc.constraint_type = 'UNIQUE'
          AND ccu1.column_name = 'organization_id'
          AND ccu2.column_name = 'user_id'
    ) THEN
        constraint_violations := array_append(constraint_violations, 'Missing unique constraint on organization_members(organization_id, user_id)');
    END IF;
    
    health_data := jsonb_build_object(
        'core_tables', table_count,
        'rls_functions', function_count,
        'rls_policies', policy_count,
        'constraint_violations', constraint_violations,
        'status', CASE 
            WHEN array_length(constraint_violations, 1) IS NULL THEN 'healthy'
            ELSE 'issues_detected'
        END,
        'checked_at', now()
    );
    
    RETURN health_data;
END;
$function$;

-- 6. Log the cleanup (only if at least one organization exists)
-- This is idempotent and safe for fresh/empty databases with no org rows yet.
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Pick the first existing organization (or NULL if none exist)
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

    -- Only insert audit log if an organization exists
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
            'schema.cleanup',
            'other',
            'schema_standardization',
            'success',
            'internal',
            jsonb_build_object(
                'cleanup_type', 'constraint_standardization',
                'tables_affected', ARRAY['organization_invitations', 'organization_members'],
                'backward_compatibility', 'org_subscriptions_legacy view created',
                'health_check_added', true,
                'timestamp', now()
            )
        );
        RAISE NOTICE 'Audit log entry created for schema cleanup (org_id: %)', v_org_id;
    ELSE
        RAISE NOTICE 'Skipping audit log: no organizations exist yet (empty database)';
    END IF;
END $$;
