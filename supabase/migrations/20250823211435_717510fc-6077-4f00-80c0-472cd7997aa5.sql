-- Create role enum if not exists (idempotent)
DO $$ BEGIN
    CREATE TYPE public.role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Backup function to normalize role values
CREATE OR REPLACE FUNCTION public.normalize_role(input_role text)
RETURNS public.role
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Convert to lowercase and normalize
    CASE lower(trim(input_role))
        WHEN 'owner' THEN RETURN 'admin'::public.role;
        WHEN 'admin' THEN RETURN 'admin'::public.role;
        WHEN 'editor' THEN RETURN 'editor'::public.role;
        WHEN 'viewer' THEN RETURN 'viewer'::public.role;
        WHEN 'user' THEN RETURN 'user'::public.role;
        ELSE RAISE EXCEPTION 'Invalid role: %. Must be one of: admin, editor, viewer, user', input_role;
    END CASE;
END;
$$;

-- Migrate organization_members.role to enum if it's still text
DO $$
BEGIN
    -- Check if role column exists and is text type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_members' 
        AND column_name = 'role' 
        AND data_type = 'text'
    ) THEN
        -- First normalize any 'owner' values to 'admin'
        UPDATE public.organization_members 
        SET role = 'admin' 
        WHERE lower(role) = 'owner';
        
        -- Drop default before conversion
        ALTER TABLE public.organization_members 
        ALTER COLUMN role DROP DEFAULT;
        
        -- Convert column to enum type
        ALTER TABLE public.organization_members 
        ALTER COLUMN role TYPE public.role 
        USING normalize_role(role);
        
        -- Set new default value after conversion
        ALTER TABLE public.organization_members 
        ALTER COLUMN role SET DEFAULT 'user'::public.role;
    END IF;
END $$;

-- Migrate organization_invitations.role to enum if it's still text
DO $$
BEGIN
    -- Check if role column exists and is text type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_invitations' 
        AND column_name = 'role' 
        AND data_type = 'text'
    ) THEN
        -- First normalize any 'owner' values to 'admin'
        UPDATE public.organization_invitations 
        SET role = 'admin' 
        WHERE lower(role) = 'owner';
        
        -- Drop default before conversion
        ALTER TABLE public.organization_invitations 
        ALTER COLUMN role DROP DEFAULT;
        
        -- Convert column to enum type
        ALTER TABLE public.organization_invitations 
        ALTER COLUMN role TYPE public.role 
        USING normalize_role(role);
        
        -- Set new default value after conversion
        ALTER TABLE public.organization_invitations 
        ALTER COLUMN role SET DEFAULT 'viewer'::public.role;
    END IF;
END $$;

-- Create validation triggers as fallback if enum conversion fails
CREATE OR REPLACE FUNCTION public.validate_role_before_insert_or_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-lowercase and normalize the role
    NEW.role := normalize_role(NEW.role::text);
    RETURN NEW;
END;
$$;

-- Apply triggers to organization_members if role is still text
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_members' 
        AND column_name = 'role' 
        AND data_type = 'text'
    ) THEN
        -- Drop trigger if exists and recreate
        DROP TRIGGER IF EXISTS validate_organization_members_role ON public.organization_members;
        CREATE TRIGGER validate_organization_members_role
            BEFORE INSERT OR UPDATE ON public.organization_members
            FOR EACH ROW
            EXECUTE FUNCTION public.validate_role_before_insert_or_update();
    END IF;
END $$;

-- Apply triggers to organization_invitations if role is still text
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_invitations' 
        AND column_name = 'role' 
        AND data_type = 'text'
    ) THEN
        -- Drop trigger if exists and recreate
        DROP TRIGGER IF EXISTS validate_organization_invitations_role ON public.organization_invitations;
        CREATE TRIGGER validate_organization_invitations_role
            BEFORE INSERT OR UPDATE ON public.organization_invitations
            FOR EACH ROW
            EXECUTE FUNCTION public.validate_role_before_insert_or_update();
    END IF;
END $$;

-- Update RPC functions to use the role enum
CREATE OR REPLACE FUNCTION public.create_invite(
    org_id uuid,
    invite_email text,
    invite_role public.role
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
        invite_role,
        auth.uid(),
        token
    ) RETURNING id INTO invitation_id;
    
    RETURN invitation_id;
END;
$$;