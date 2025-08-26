-- Database Health Check Supporting Functions
-- Add functions to support the new DB health checks

-- Function to get duplicate organization members (same org_id + user_id combo)
CREATE OR REPLACE FUNCTION public.get_duplicate_org_members()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM (
    SELECT organization_id, user_id, count(*) as dupes
    FROM public.organization_members
    GROUP BY organization_id, user_id
    HAVING count(*) > 1
  ) duplicates;
$function$;

-- Function to check RLS status on specific tables
CREATE OR REPLACE FUNCTION public.check_table_rls_status(table_names text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{}';
  table_name text;
  rls_enabled boolean;
BEGIN
  FOREACH table_name IN ARRAY table_names
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_name
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    result := result || jsonb_build_object(table_name, COALESCE(rls_enabled, false));
  END LOOP;
  
  RETURN result;
END;
$function$;

-- Function to find potentially unused tables in public schema
CREATE OR REPLACE FUNCTION public.find_potentially_unused_tables()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '[]';
  table_record record;
  row_count bigint;
  is_referenced boolean;
BEGIN
  FOR table_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN (
        'organizations', 'organization_members', 'organization_invitations', 
        'org_stripe_subscriptions', 'profiles', 'superadmins', 'audit_log',
        'activity_logs', 'plan_configs', 'step_up_sessions', 'rate_limits'
      )
  LOOP
    -- Check if table has foreign key references TO it or FROM it
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (kcu.table_name = table_record.table_name OR kcu.referenced_table_name = table_record.table_name)
        AND tc.table_schema = 'public'
    ) INTO is_referenced;
    
    -- Check if referenced by views
    IF NOT is_referenced THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE view_definition ILIKE '%' || table_record.table_name || '%'
          AND table_schema = 'public'
      ) INTO is_referenced;
    END IF;
    
    -- Check if referenced by policies
    IF NOT is_referenced THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE definition ILIKE '%' || table_record.table_name || '%'
          OR qual::text ILIKE '%' || table_record.table_name || '%'
          OR with_check::text ILIKE '%' || table_record.table_name || '%'
      ) INTO is_referenced;
    END IF;
    
    -- If not referenced, get row count and add to result
    IF NOT is_referenced THEN
      EXECUTE format('SELECT count(*) FROM public.%I', table_record.table_name) INTO row_count;
      
      result := result || jsonb_build_array(
        jsonb_build_object(
          'name', table_record.table_name,
          'row_count', row_count,
          'last_accessed', null  -- Could add pg_stat_user_tables data here if needed
        )
      );
    END IF;
  END LOOP;
  
  RETURN result;
END;
$function$;