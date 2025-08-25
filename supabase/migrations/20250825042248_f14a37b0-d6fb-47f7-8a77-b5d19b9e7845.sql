-- Owner role management - simplified approach

-- 1. Add unique constraint on organization_members to prevent duplicate memberships
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organization_members_org_user_unique'
  ) THEN
    ALTER TABLE public.organization_members 
    ADD CONSTRAINT organization_members_org_user_unique 
    UNIQUE (organization_id, user_id);
  END IF;
END $$;

-- 2. Standardize status column naming (replace suspension_status with status)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' 
      AND column_name = 'suspension_status'
  ) THEN
    ALTER TABLE public.organizations 
    RENAME COLUMN suspension_status TO status;
  END IF;
END $$;

-- 3. Create function to check if user is organization owner
CREATE OR REPLACE FUNCTION public.is_organization_owner(org_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = org_id AND owner_user_id = user_id
  );
$$;

-- 4. Create function to check if removal would leave org without admins
CREATE OR REPLACE FUNCTION public.would_leave_org_without_admins(org_id uuid, user_id_to_remove uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
  is_owner boolean;
BEGIN
  -- Check if the user being removed is the owner (owner counts as admin)
  SELECT (owner_user_id = user_id_to_remove) INTO is_owner
  FROM public.organizations 
  WHERE id = org_id;
  
  -- Count remaining admins (excluding the user being removed)
  SELECT COUNT(*) INTO admin_count
  FROM public.organization_members
  WHERE organization_id = org_id 
    AND role::text = 'admin'
    AND seat_active = true 
    AND user_id != user_id_to_remove;
  
  -- If removing owner, they count as losing an admin
  -- If removing a regular admin, check if any admins remain (plus owner)
  IF is_owner THEN
    RETURN admin_count = 0; -- Would leave with no admins (owner being removed)
  ELSE
    RETURN (admin_count = 0 AND NOT EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id AND owner_user_id IS NOT NULL
    ));
  END IF;
END;
$$;

-- 5. Transfer ownership function
CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
  p_org_id uuid,
  p_new_owner_user_id uuid,
  p_keep_old_owner_as_admin boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  old_owner_id uuid;
  is_superadmin boolean;
  org_name text;
  old_owner_email text;
  new_owner_email text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Get current owner and org details
  SELECT owner_user_id, name INTO old_owner_id, org_name
  FROM public.organizations 
  WHERE id = p_org_id;
  
  IF old_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;
  
  -- Check if current user is superadmin
  SELECT public.is_superadmin(current_user_id) INTO is_superadmin;
  
  -- Verify authorization (must be current owner or superadmin)
  IF current_user_id != old_owner_id AND NOT is_superadmin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the current owner or superadmin can transfer ownership');
  END IF;
  
  -- Verify new owner is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = p_org_id 
      AND user_id = p_new_owner_user_id 
      AND seat_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'New owner must be an active member of the organization');
  END IF;
  
  -- Get email addresses for audit log
  SELECT email INTO old_owner_email FROM public.profiles WHERE id = old_owner_id;
  SELECT email INTO new_owner_email FROM public.profiles WHERE id = p_new_owner_user_id;
  
  -- Transfer ownership
  UPDATE public.organizations 
  SET owner_user_id = p_new_owner_user_id
  WHERE id = p_org_id;
  
  -- Ensure new owner has admin role
  INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
  VALUES (p_org_id, p_new_owner_user_id, 'admin', true)
  ON CONFLICT (organization_id, user_id) 
  DO UPDATE SET role = 'admin', seat_active = true;
  
  -- Optionally keep old owner as admin
  IF p_keep_old_owner_as_admin AND old_owner_id != p_new_owner_user_id THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
    VALUES (p_org_id, old_owner_id, 'admin', true)
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET role = 'admin', seat_active = true;
  END IF;
  
  -- Log the ownership transfer
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
    p_org_id,
    current_user_id,
    CASE WHEN is_superadmin THEN 'superadmin' ELSE 'admin' END,
    'ownership.transferred',
    'organization',
    p_org_id::text,
    'success',
    'audit',
    jsonb_build_object(
      'organization_name', org_name,
      'from_user', old_owner_id,
      'to_user', p_new_owner_user_id,
      'from_email', old_owner_email,
      'to_email', new_owner_email,
      'keep_old_owner_as_admin', p_keep_old_owner_as_admin,
      'transferred_by', CASE WHEN is_superadmin THEN 'superadmin' ELSE 'owner' END
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'old_owner', old_owner_id,
    'new_owner', p_new_owner_user_id,
    'organization_id', p_org_id
  );
END;
$$;

-- 6. Create trigger function to protect owner operations
CREATE OR REPLACE FUNCTION public.protect_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For DELETE operations
  IF TG_OP = 'DELETE' THEN
    -- Prevent owner membership deletion
    IF EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = OLD.organization_id AND owner_user_id = OLD.user_id
    ) THEN
      RAISE EXCEPTION 'Cannot delete owner membership. Transfer ownership first.';
    END IF;
    
    -- Prevent last admin removal
    IF public.would_leave_org_without_admins(OLD.organization_id, OLD.user_id) THEN
      RAISE EXCEPTION 'Cannot remove the last admin from organization.';
    END IF;
    
    RETURN OLD;
  END IF;
  
  -- For UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Prevent owner role/status changes
    IF EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = NEW.organization_id AND owner_user_id = NEW.user_id
    ) THEN
      IF OLD.role != NEW.role OR OLD.seat_active != NEW.seat_active THEN
        RAISE EXCEPTION 'Cannot modify owner membership role or status. Transfer ownership first.';
      END IF;
    END IF;
    
    -- Prevent last admin role change
    IF OLD.role::text = 'admin' AND NEW.role::text != 'admin' THEN
      IF public.would_leave_org_without_admins(NEW.organization_id, NEW.user_id) THEN
        RAISE EXCEPTION 'Cannot change role of the last admin in organization.';
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 7. Create trigger to protect owner membership
DROP TRIGGER IF EXISTS protect_owner_membership_trigger ON public.organization_members;
CREATE TRIGGER protect_owner_membership_trigger
  BEFORE UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_owner_membership();

-- 8. Update functions that reference suspension_status to use status
CREATE OR REPLACE FUNCTION public.is_org_suspended(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status = 'suspended'
  FROM public.organizations
  WHERE id = org_id;
$$;

CREATE OR REPLACE FUNCTION public.is_org_suspended_or_canceled(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status IN ('suspended', 'canceled')
  FROM public.organizations
  WHERE id = org_id;
$$;

CREATE OR REPLACE FUNCTION public.is_org_active(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status = 'active'
  FROM public.organizations
  WHERE id = p_org_id;
$$;