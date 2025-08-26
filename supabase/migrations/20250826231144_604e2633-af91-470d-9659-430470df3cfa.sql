-- Schema cleanup migration - safe and idempotent
-- Check and standardize unique constraints

-- 1. Safely handle organization_invitations unique constraint
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'organization_invitations' 
          AND constraint_name = 'organization_invitations_invite_token_unique'
          AND constraint_type = 'UNIQUE'
    ) INTO constraint_exists;
    
    IF NOT constraint_exists THEN
        DROP INDEX IF EXISTS organization_invitations_invite_token_key;
        ALTER TABLE organization_invitations 
        ADD CONSTRAINT organization_invitations_invite_token_unique UNIQUE (invite_token);
    END IF;
END $$;

-- 2. Safely handle organization_members unique constraint  
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'organization_members' 
          AND constraint_name = 'organization_members_org_user_unique'
          AND constraint_type = 'UNIQUE'
    ) INTO constraint_exists;
    
    IF NOT constraint_exists THEN
        ALTER TABLE organization_members 
        ADD CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id);
    END IF;
END $$;

-- 3. Add DB health check function for admin diagnostics
CREATE OR REPLACE FUNCTION public.get_schema_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    health_data jsonb := '{}';
    core_tables_count integer;
    rls_functions_count integer;
    rls_policies_count integer;
    missing_constraints text[] := ARRAY[]::text[];
    table_stats jsonb := '{}';
BEGIN
    -- Count core organization tables
    SELECT COUNT(*) INTO core_tables_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('organizations', 'organization_members', 'organization_invitations', 'org_stripe_subscriptions');
    
    -- Count critical RLS functions
    SELECT COUNT(*) INTO rls_functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('check_admin_access', 'check_org_membership', 'check_org_ownership', 'is_org_admin', 'is_org_member');
    
    -- Count RLS policies on core tables
    SELECT COUNT(*) INTO rls_policies_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('organizations', 'organization_members', 'organization_invitations');
    
    -- Get table statistics
    SELECT jsonb_object_agg(table_name, row_count) INTO table_stats
    FROM (
        SELECT 'organizations' as table_name, COUNT(*) as row_count FROM organizations
        UNION ALL
        SELECT 'organization_members', COUNT(*) FROM organization_members
        UNION ALL
        SELECT 'organization_invitations', COUNT(*) FROM organization_invitations
        UNION ALL
        SELECT 'org_stripe_subscriptions', COUNT(*) FROM org_stripe_subscriptions
    ) t;
    
    -- Check for missing critical constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'organization_invitations' 
          AND constraint_type = 'UNIQUE'
          AND constraint_name LIKE '%invite_token%'
    ) THEN
        missing_constraints := array_append(missing_constraints, 'organization_invitations.invite_token unique constraint');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu1 ON tc.constraint_name = ccu1.constraint_name
        JOIN information_schema.constraint_column_usage ccu2 ON tc.constraint_name = ccu2.constraint_name  
        WHERE tc.table_name = 'organization_members'
          AND tc.constraint_type = 'UNIQUE'
          AND ccu1.column_name = 'organization_id'
          AND ccu2.column_name = 'user_id'
    ) THEN
        missing_constraints := array_append(missing_constraints, 'organization_members(organization_id, user_id) unique constraint');
    END IF;
    
    -- Build health report
    health_data := jsonb_build_object(
        'status', CASE 
            WHEN array_length(missing_constraints, 1) IS NULL THEN 'healthy'
            ELSE 'issues_detected'
        END,
        'core_tables_count', core_tables_count,
        'rls_functions_count', rls_functions_count,
        'rls_policies_count', rls_policies_count,
        'table_statistics', table_stats,
        'missing_constraints', missing_constraints,
        'schema_version', '2.0_standardized',
        'canonical_subscription_table', 'org_stripe_subscriptions',
        'last_checked', now()
    );
    
    RETURN health_data;
END;
$function$;