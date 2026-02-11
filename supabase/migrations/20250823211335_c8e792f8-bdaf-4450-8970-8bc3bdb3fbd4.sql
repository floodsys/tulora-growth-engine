-- Create org_role enum if not exists (idempotent)
DO $$ BEGIN
    CREATE TYPE public.org_role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Backup function to normalize role values (returns text to avoid enum-to-enum cast issues)
CREATE OR REPLACE FUNCTION public.normalize_role(input_role text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Handle NULL/empty input by defaulting to 'user'
    IF input_role IS NULL OR trim(input_role) = '' THEN
        RETURN 'user';
    END IF;

    -- Convert to lowercase and normalize
    CASE lower(trim(input_role))
        WHEN 'owner' THEN RETURN 'admin';
        WHEN 'admin' THEN RETURN 'admin';
        WHEN 'editor' THEN RETURN 'editor';
        WHEN 'viewer' THEN RETURN 'viewer';
        WHEN 'user' THEN RETURN 'user';
        WHEN 'member' THEN RETURN 'user';
        ELSE RAISE EXCEPTION 'Invalid role: %. Must be one of: admin, editor, viewer, user', input_role;
    END CASE;
END;
$$;

-- Drop any CHECK constraints on role column that might cause enum=text comparisons
DO $outer$
DECLARE
  constraint_name text;
BEGIN
  -- Skip if table doesn't exist
  IF to_regclass('public.organization_members') IS NULL THEN
    RETURN;
  END IF;

  -- Find and drop any CHECK constraints on the role column
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.organization_members'::regclass
      AND att.attname = 'role'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $outer$;

-- Migrate organization_members.role to enum if it's still text
-- This migration is idempotent: skips if column is already org_role type
DO $outer$
DECLARE
  col_type_name text;
BEGIN
  -- Skip if table doesn't exist (idempotent on fresh DB)
  IF to_regclass('public.organization_members') IS NULL THEN
    RETURN;
  END IF;

  -- Fetch column type name from catalog (use typname for reliable comparison)
  SELECT t.typname INTO col_type_name
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
  WHERE a.attrelid = 'public.organization_members'::regclass
    AND a.attname = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF col_type_name IS NULL THEN
    RETURN;
  END IF;

  -- If NOT text, it's already been converted (could be org_role or any other type)
  -- Just ensure default is correct and exit
  IF col_type_name != 'text' THEN
    BEGIN
      EXECUTE $e$ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'user'::public.org_role$e$;
    EXCEPTION WHEN others THEN
      NULL;
    END;
    RETURN;
  END IF;

  -- Drop default safely (it may be text-typed)
  BEGIN
    EXECUTE $e$ALTER TABLE public.organization_members ALTER COLUMN role DROP DEFAULT$e$;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Convert to enum using role::text to avoid any enum/text operator issues
  EXECUTE $e$ALTER TABLE public.organization_members
            ALTER COLUMN role TYPE public.org_role
            USING normalize_role(role::text)::public.org_role$e$;

  EXECUTE $e$ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'user'::public.org_role$e$;
END $outer$;

-- Migrate organization_invitations.role to enum if it's still text
-- This migration is idempotent: skips if column is already org_role type
DO $outer$
DECLARE
  col_type_name text;
BEGIN
  -- Skip if table doesn't exist (idempotent on fresh DB)
  IF to_regclass('public.organization_invitations') IS NULL THEN
    RETURN;
  END IF;

  -- Fetch column type name from catalog (use typname for reliable comparison)
  SELECT t.typname INTO col_type_name
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
  WHERE a.attrelid = 'public.organization_invitations'::regclass
    AND a.attname = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF col_type_name IS NULL THEN
    RETURN;
  END IF;

  -- If NOT text, it's already been converted (could be org_role or any other type)
  -- Just ensure default is correct and exit
  IF col_type_name != 'text' THEN
    BEGIN
      EXECUTE $e$ALTER TABLE public.organization_invitations ALTER COLUMN role SET DEFAULT 'viewer'::public.org_role$e$;
    EXCEPTION WHEN others THEN
      NULL;
    END;
    RETURN;
  END IF;

  -- Drop default safely (it may be text-typed)
  BEGIN
    EXECUTE $e$ALTER TABLE public.organization_invitations ALTER COLUMN role DROP DEFAULT$e$;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Convert to enum using role::text to avoid any enum/text operator issues
  EXECUTE $e$ALTER TABLE public.organization_invitations
            ALTER COLUMN role TYPE public.org_role
            USING normalize_role(role::text)::public.org_role$e$;

  EXECUTE $e$ALTER TABLE public.organization_invitations ALTER COLUMN role SET DEFAULT 'viewer'::public.org_role$e$;
END $outer$;

-- Create validation triggers as fallback if enum conversion fails
CREATE OR REPLACE FUNCTION public.validate_role_before_insert_or_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-lowercase and normalize the role (cast to text to avoid enum/text issues)
    NEW.role := normalize_role(NEW.role::text);
    RETURN NEW;
END;
$$;

-- Apply triggers to organization_members if role is still text (not yet enum)
DO $outer$
DECLARE
  col_type_name text;
BEGIN
  -- Skip if table doesn't exist
  IF to_regclass('public.organization_members') IS NULL THEN
    RETURN;
  END IF;

  SELECT t.typname INTO col_type_name
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
  WHERE a.attrelid = 'public.organization_members'::regclass
    AND a.attname = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  -- Only apply trigger if still text type
  IF col_type_name = 'text' THEN
    EXECUTE $e$DROP TRIGGER IF EXISTS validate_organization_members_role ON public.organization_members$e$;
    EXECUTE $e$CREATE TRIGGER validate_organization_members_role
        BEFORE INSERT OR UPDATE ON public.organization_members
        FOR EACH ROW
        EXECUTE FUNCTION public.validate_role_before_insert_or_update()$e$;
  END IF;
END $outer$;

-- Apply triggers to organization_invitations if role is still text (not yet enum)
DO $outer$
DECLARE
  col_type_name text;
BEGIN
  -- Skip if table doesn't exist
  IF to_regclass('public.organization_invitations') IS NULL THEN
    RETURN;
  END IF;

  SELECT t.typname INTO col_type_name
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
  WHERE a.attrelid = 'public.organization_invitations'::regclass
    AND a.attname = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  -- Only apply trigger if still text type
  IF col_type_name = 'text' THEN
    EXECUTE $e$DROP TRIGGER IF EXISTS validate_organization_invitations_role ON public.organization_invitations$e$;
    EXECUTE $e$CREATE TRIGGER validate_organization_invitations_role
        BEFORE INSERT OR UPDATE ON public.organization_invitations
        FOR EACH ROW
        EXECUTE FUNCTION public.validate_role_before_insert_or_update()$e$;
  END IF;
END $outer$;

-- Fix is_org_admin function to use proper enum comparison (cast enum to text)
-- Removed: DROP FUNCTION IF EXISTS public.is_org_admin(uuid) CASCADE;
-- (CREATE OR REPLACE handles redefinition safely without breaking dependent policies)
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = $1
      AND m.user_id = auth.uid()
      AND m.role::text = 'admin'
      AND m.seat_active = true
  ) OR EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = $1
      AND owner_user_id = auth.uid()
  );
$$;

-- Fix is_org_member function to use proper column name
-- Removed: DROP FUNCTION IF EXISTS public.is_org_member(uuid) CASCADE;
-- (CREATE OR REPLACE handles redefinition safely without breaking dependent policies)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = $1
      AND m.user_id = auth.uid()
      AND m.seat_active = true
  ) OR EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = $1
      AND owner_user_id = auth.uid()
  );
$$;

-- Update RPC functions to use text input and cast to org_role
-- Removed: DROP FUNCTION IF EXISTS public.create_invite(uuid, text, public.org_role);
-- (CREATE OR REPLACE handles redefinition safely without breaking dependent policies)
-- Removed: DROP FUNCTION IF EXISTS public.create_invite(uuid, text, text);
-- (CREATE OR REPLACE handles redefinition safely without breaking dependent policies)
CREATE OR REPLACE FUNCTION public.create_invite(
    org_id uuid,
    invite_email text,
    invite_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    token text;
    invitation_id uuid;
BEGIN
    -- Check if user is admin of the organization
    IF NOT is_org_admin(org_id) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Generate unique token
    token := encode(gen_random_bytes(32), 'base64url');
    
    -- Insert invitation
    INSERT INTO public.organization_invitations (
        organization_id,
        email,
        role,
        invited_by,
        invite_token
    ) VALUES (
        org_id,
        invite_email,
        normalize_role(invite_role)::public.org_role,
        auth.uid(),
        token
    ) RETURNING id INTO invitation_id;
    
    RETURN invitation_id;
END;
$$;
