-- Ensure proper function ownership and grants

-- Check current ownership and grants
SELECT 
  p.proname as function_name,
  p.proowner::regrole as owner,
  array_agg(DISTINCT pr.rolname) as granted_to
FROM pg_proc p
LEFT JOIN pg_proc_acl pa ON pa.oid = p.oid
LEFT JOIN pg_roles pr ON pr.oid = ANY(pa.grantee)
WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND p.proname IN ('check_admin_access', 'check_org_membership', 'check_org_ownership', 'is_organization_owner', 'would_leave_org_without_admins')
GROUP BY p.proname, p.proowner
ORDER BY p.proname;

-- Ensure all functions are owned by postgres
ALTER FUNCTION public.check_admin_access(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.check_org_membership(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.check_org_ownership(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.is_organization_owner(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.would_leave_org_without_admins(uuid, uuid) OWNER TO postgres;

-- Grant EXECUTE to authenticated role (PostgREST calls with JWT)
GRANT EXECUTE ON FUNCTION public.check_admin_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_org_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_org_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.would_leave_org_without_admins(uuid, uuid) TO authenticated;

-- Also grant to public for wider access if needed
GRANT EXECUTE ON FUNCTION public.check_admin_access(uuid, uuid) TO public;
GRANT EXECUTE ON FUNCTION public.check_org_membership(uuid, uuid) TO public;
GRANT EXECUTE ON FUNCTION public.check_org_ownership(uuid, uuid) TO public;