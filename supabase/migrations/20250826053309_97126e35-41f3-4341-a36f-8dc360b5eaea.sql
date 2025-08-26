-- Create function to get security snapshot data
CREATE OR REPLACE FUNCTION public.get_security_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  snapshot_data jsonb := '{}'::jsonb;
  table_info jsonb;
  rls_info jsonb;
  policies_info jsonb[];
  functions_info jsonb[];
  grants_info jsonb[];
  function_record record;
  policy_record record;
  grant_record record;
BEGIN
  -- Only allow superadmins to run this
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized: Only superadmins can access security snapshot';
  END IF;

  -- Get table owners and RLS status
  SELECT jsonb_agg(
    jsonb_build_object(
      'table_name', schemaname || '.' || tablename,
      'owner', tableowner,
      'has_rls', row_security = 'on',
      'force_rls', row_security = 'force'
    )
  ) INTO table_info
  FROM (
    SELECT schemaname, tablename, tableowner, 
           CASE WHEN rls.oid IS NOT NULL THEN 'on' ELSE 'off' END as row_security
    FROM pg_tables pt
    LEFT JOIN pg_class rls ON rls.relname = pt.tablename AND rls.relnamespace = (
      SELECT oid FROM pg_namespace WHERE nspname = pt.schemaname
    ) AND rls.relrowsecurity = true
    WHERE schemaname IN ('public')
    ORDER BY tablename
  ) t;

  -- Get policies referencing check_admin_access / check_org_membership
  SELECT array_agg(
    jsonb_build_object(
      'policy_name', polname,
      'table_name', schemaname || '.' || tablename,
      'command', cmd,
      'using_expression', CASE WHEN qual IS NOT NULL THEN pg_get_expr(qual, c.oid) ELSE NULL END,
      'check_expression', CASE WHEN with_check IS NOT NULL THEN pg_get_expr(with_check, c.oid) ELSE NULL END,
      'references_admin_access', 
        (pg_get_expr(qual, c.oid) LIKE '%check_admin_access%' OR 
         pg_get_expr(with_check, c.oid) LIKE '%check_admin_access%'),
      'references_org_membership', 
        (pg_get_expr(qual, c.oid) LIKE '%check_org_membership%' OR 
         pg_get_expr(with_check, c.oid) LIKE '%check_org_membership%')
    )
  ) INTO policies_info
  FROM pg_policy pol
  JOIN pg_class c ON pol.polrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  JOIN LATERAL (
    SELECT n.nspname as schemaname, c.relname as tablename
  ) t ON true
  JOIN LATERAL (
    SELECT CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT' 
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
      ELSE pol.polcmd::text
    END as cmd
  ) cmd_info ON true
  WHERE n.nspname = 'public'
    AND (pg_get_expr(pol.polqual, c.oid) LIKE '%check_admin_access%' 
         OR pg_get_expr(pol.polqual, c.oid) LIKE '%check_org_membership%'
         OR pg_get_expr(pol.polwithcheck, c.oid) LIKE '%check_admin_access%'
         OR pg_get_expr(pol.polwithcheck, c.oid) LIKE '%check_org_membership%');

  -- Get functions info
  SELECT array_agg(
    jsonb_build_object(
      'function_name', proname,
      'owner', pg_get_userbyid(proowner),
      'security_definer', prosecdef,
      'volatility', CASE provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
      END,
      'search_path', COALESCE(prosrc LIKE '%search_path%', false)
    )
  ) INTO functions_info
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND proname IN ('check_admin_access', 'check_org_membership', 'check_org_ownership', 'is_superadmin', 'is_org_admin', 'is_org_member');

  -- Get grants info
  SELECT array_agg(
    jsonb_build_object(
      'object_name', routine_name,
      'object_type', 'FUNCTION',
      'grantee', grantee,
      'privilege_type', privilege_type,
      'is_grantable', is_grantable
    )
  ) INTO grants_info
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND routine_name IN ('check_admin_access', 'check_org_membership', 'check_org_ownership', 'is_superadmin', 'is_org_admin', 'is_org_member')
    AND grantee IN ('authenticated', 'anon', 'public');

  -- Build final snapshot
  snapshot_data := jsonb_build_object(
    'timestamp', now(),
    'tables', COALESCE(table_info, '[]'::jsonb),
    'policies', COALESCE(policies_info, ARRAY[]::jsonb[]),
    'functions', COALESCE(functions_info, ARRAY[]::jsonb[]),
    'grants', COALESCE(grants_info, ARRAY[]::jsonb[]),
    'build_info', jsonb_build_object(
      'supabase_url', 'https://nkjxbeypbiclvouqfjyc.supabase.co',
      'project_id', 'nkjxbeypbiclvouqfjyc',
      'anon_key_fingerprint', substring(md5('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg'), 1, 8)
    )
  );

  RETURN snapshot_data;
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_security_snapshot() TO authenticated;

-- Create function to activate user seat and get seat status
CREATE OR REPLACE FUNCTION public.activate_seat_and_get_status(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  seat_info jsonb;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Activate seat for current user if they are a member but seat is inactive
  UPDATE public.organization_members
  SET seat_active = true
  WHERE organization_id = p_org_id 
    AND user_id = current_user_id
    AND seat_active = false;

  -- Get current seat status
  SELECT jsonb_build_object(
    'user_id', current_user_id,
    'organization_id', p_org_id,
    'role', COALESCE(om.role::text, 'none'),
    'seat_active', COALESCE(om.seat_active, false),
    'is_owner', (o.owner_user_id = current_user_id),
    'membership_exists', (om.id IS NOT NULL),
    'updated_at', COALESCE(om.created_at, now())
  ) INTO seat_info
  FROM public.organizations o
  LEFT JOIN public.organization_members om ON om.organization_id = o.id AND om.user_id = current_user_id
  WHERE o.id = p_org_id;

  RETURN COALESCE(seat_info, jsonb_build_object('error', 'Organization not found'));
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.activate_seat_and_get_status(uuid) TO authenticated;