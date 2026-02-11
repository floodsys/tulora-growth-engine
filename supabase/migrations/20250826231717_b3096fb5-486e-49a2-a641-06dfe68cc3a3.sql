-- Membership & Ownership Canonicalization Migration
-- Ensure all ownership/membership checks use canonical helpers and tables

-- 1. Add missing helper functions if they don't exist

-- Enhanced membership check function
CREATE OR REPLACE FUNCTION public.check_org_membership(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Check if user is a member via organization_members table
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id 
      AND user_id = COALESCE(p_user_id, auth.uid())
      AND seat_active = true
  ) OR 
  -- OR if user is the organization owner
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id 
      AND owner_user_id = COALESCE(p_user_id, auth.uid())
  );
$function$;

-- Enhanced ownership check function  
CREATE OR REPLACE FUNCTION public.check_org_ownership(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id 
      AND owner_user_id = COALESCE(p_user_id, auth.uid())
  );
$function$;

-- Enhanced admin access check function (ownership OR admin role OR superadmin)
CREATE OR REPLACE FUNCTION public.check_admin_access(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
  -- Organization owner has admin access
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id 
      AND owner_user_id = COALESCE(p_user_id, auth.uid())
  ) OR
  -- Admin role members have admin access
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id 
      AND user_id = COALESCE(p_user_id, auth.uid())
      AND role = 'admin'::org_role
      AND seat_active = true
  ) OR
  -- Superadmins have admin access to any org
  public.is_superadmin(COALESCE(p_user_id, auth.uid()));
$function$;

-- Member seat management function
CREATE OR REPLACE FUNCTION public.admin_toggle_member_seat(p_organization_id uuid, p_user_id uuid, p_seat_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  member_email text;
  org_name text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if current user has admin access
  IF NOT public.check_admin_access(p_organization_id, current_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get member and org details for logging
  SELECT p.email, o.name INTO member_email, org_name
  FROM public.profiles p, public.organizations o
  WHERE p.id = p_user_id AND o.id = p_organization_id;

  -- Update the seat status
  UPDATE public.organization_members 
  SET seat_active = p_seat_active
  WHERE organization_id = p_organization_id 
    AND user_id = p_user_id;

  -- Log the action
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
    p_organization_id,
    current_user_id,
    'admin',
    CASE WHEN p_seat_active THEN 'member.seat_activated' ELSE 'member.seat_deactivated' END,
    'member',
    p_user_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'member_email', member_email,
      'seat_active', p_seat_active,
      'organization_name', org_name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'seat_active', p_seat_active
  );
END;
$function$;

-- 2. Create canonical role retrieval function
-- Drop existing function first if it has a different return type
-- Removed: DROP FUNCTION IF EXISTS public.get_user_org_role(uuid, uuid);
-- (CREATE OR REPLACE handles redefinition safely without breaking dependent policies)
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  is_owner boolean;
  member_role org_role;
  seat_active boolean;
BEGIN
  -- Check if user is organization owner
  SELECT (owner_user_id = COALESCE(p_user_id, auth.uid())) INTO is_owner
  FROM public.organizations
  WHERE id = p_org_id;

  IF is_owner THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'is_owner', true,
      'seat_active', true,
      'is_member', true
    );
  END IF;

  -- Check organization membership
  SELECT role, seat_active INTO member_role, seat_active
  FROM public.organization_members
  WHERE organization_id = p_org_id 
    AND user_id = COALESCE(p_user_id, auth.uid());

  IF member_role IS NOT NULL THEN
    RETURN jsonb_build_object(
      'role', member_role::text,
      'is_owner', false,
      'seat_active', COALESCE(seat_active, false),
      'is_member', true
    );
  END IF;

  -- Not a member
  RETURN jsonb_build_object(
    'role', null,
    'is_owner', false,
    'seat_active', false,
    'is_member', false
  );
END;
$function$;

-- 3. Log the canonicalization (only if at least one organization exists)
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
            'membership.canonicalization',
            'other',
            'canonical_helpers',
            'success',
            'internal',
            jsonb_build_object(
                'canonical_functions', ARRAY[
                    'check_org_membership',
                    'check_org_ownership', 
                    'check_admin_access',
                    'admin_toggle_member_seat',
                    'get_user_org_role'
                ],
                'canonical_tables', ARRAY[
                    'organizations.owner_user_id',
                    'organization_members'
                ],
                'legacy_removed', 'memberships table dependencies',
                'timestamp', now()
            )
        );
        RAISE NOTICE 'Membership canonicalization logged for org_id: %', v_org_id;
    ELSE
        RAISE NOTICE 'Skipping canonicalization log: no organizations exist yet';
    END IF;
END $$;
