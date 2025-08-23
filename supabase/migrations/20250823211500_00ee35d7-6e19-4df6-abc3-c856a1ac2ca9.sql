-- Create role enum if not exists (idempotent) - using different name to avoid conflicts
DO $$ BEGIN
    CREATE TYPE public.role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Function to normalize role values and handle 'owner' -> 'admin' conversion
CREATE OR REPLACE FUNCTION public.normalize_role_value(input_role text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Convert to lowercase and normalize
    CASE lower(trim(input_role))
        WHEN 'owner' THEN RETURN 'admin';
        WHEN 'admin' THEN RETURN 'admin';
        WHEN 'editor' THEN RETURN 'editor';
        WHEN 'viewer' THEN RETURN 'viewer';
        WHEN 'user' THEN RETURN 'user';
        ELSE RAISE EXCEPTION 'Invalid role: %. Must be one of: admin, editor, viewer, user', input_role;
    END CASE;
END;
$$;

-- Normalize existing data in organization_members (handle both text and enum cases)
UPDATE public.organization_members 
SET role = 'admin'::public.org_role 
WHERE role::text = 'owner';

-- Normalize existing data in organization_invitations (handle both text and enum cases)
UPDATE public.organization_invitations 
SET role = 'admin'::public.org_role 
WHERE role::text = 'owner';

-- Create validation function for role columns that ensures only valid values
CREATE OR REPLACE FUNCTION public.validate_role_constraint(role_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN lower(trim(role_value)) IN ('admin', 'editor', 'viewer', 'user');
END;
$$;

-- Add check constraints to ensure role validation (if not using enum)
DO $$
BEGIN
    -- Add constraint to organization_members if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'organization_members_role_check'
    ) THEN
        ALTER TABLE public.organization_members 
        ADD CONSTRAINT organization_members_role_check 
        CHECK (validate_role_constraint(role::text));
    END IF;
    
    -- Add constraint to organization_invitations if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'organization_invitations_role_check'
    ) THEN
        ALTER TABLE public.organization_invitations 
        ADD CONSTRAINT organization_invitations_role_check 
        CHECK (validate_role_constraint(role::text));
    END IF;
END $$;

-- Create triggers to auto-normalize role values on insert/update
CREATE OR REPLACE FUNCTION public.auto_normalize_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Normalize the role value
    NEW.role := normalize_role_value(NEW.role::text)::public.org_role;
    RETURN NEW;
END;
$$;

-- Apply triggers to organization_members
DROP TRIGGER IF EXISTS auto_normalize_organization_members_role ON public.organization_members;
CREATE TRIGGER auto_normalize_organization_members_role
    BEFORE INSERT OR UPDATE ON public.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_normalize_role();

-- Apply triggers to organization_invitations  
DROP TRIGGER IF EXISTS auto_normalize_organization_invitations_role ON public.organization_invitations;
CREATE TRIGGER auto_normalize_organization_invitations_role
    BEFORE INSERT OR UPDATE ON public.organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_normalize_role();

-- Update RPC functions to use the existing org_role enum
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
    normalized_role public.org_role;
BEGIN
    -- Check if user is admin of the organization
    IF NOT is_org_admin(org_id) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Normalize the role
    normalized_role := normalize_role_value(invite_role)::public.org_role;
    
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
        normalized_role,
        auth.uid(),
        token
    ) RETURNING id INTO invitation_id;
    
    RETURN invitation_id;
END;
$$;