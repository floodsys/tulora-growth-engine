-- Ensure proper function ownership and grants
-- NOTE: Removed invalid SELECT from pg_proc_acl (doesn't exist in Postgres)

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
