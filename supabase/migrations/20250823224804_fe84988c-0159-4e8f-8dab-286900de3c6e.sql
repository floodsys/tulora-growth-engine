-- Create role enum if it doesn't exist (idempotent)
DO $$ BEGIN
    CREATE TYPE public.role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Since tables already use org_role enum with correct values, 
-- update functions to reference the new role enum for consistency

-- Update is_org_admin function to use role enum
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Check if user is organization owner OR admin member
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id 
        AND owner_user_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND role::text = 'admin'
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$function$;

-- Create a helper function that works with the role enum
CREATE OR REPLACE FUNCTION public.has_org_role(org_id uuid, required_role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Check if user has the specified role in organization
  SELECT CASE 
    WHEN required_role = 'admin' AND EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id 
        AND owner_user_id = auth.uid()
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND role::text = required_role
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$function$;

-- Ensure data consistency (idempotent normalization)
-- Convert any remaining 'owner' values to 'admin' in org_role enum
UPDATE public.organization_members 
SET role = 'admin'::public.org_role 
WHERE role::text = 'owner';

UPDATE public.organization_invitations 
SET role = 'admin'::public.org_role 
WHERE role::text = 'owner';

-- Also normalize memberships table if it exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships') THEN
        UPDATE public.memberships 
        SET role = 'admin' 
        WHERE role IN ('owner', 'Owner', 'OWNER');
    END IF;
END $$;

-- Update invite and accept functions to use consistent role handling
CREATE OR REPLACE FUNCTION public.create_invite(p_org uuid, p_email text, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    invitation_id uuid;
    invite_token text;
    expiry_date timestamptz;
    normalized_role public.org_role;
BEGIN
    -- Check if caller is org admin
    IF NOT (
        EXISTS (
            SELECT 1 FROM public.organizations 
            WHERE id = p_org AND owner_user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.organization_members 
            WHERE organization_id = p_org 
            AND user_id = auth.uid() 
            AND role::text = 'admin'
            AND seat_active = true
        )
    ) THEN
        RAISE EXCEPTION 'Authorization error: User is not an admin of this organization'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    
    -- Validate and normalize role (map owner to admin)
    CASE lower(trim(p_role))
        WHEN 'owner' THEN normalized_role := 'admin'::public.org_role;
        WHEN 'admin' THEN normalized_role := 'admin'::public.org_role;
        WHEN 'editor' THEN normalized_role := 'editor'::public.org_role;
        WHEN 'viewer' THEN normalized_role := 'viewer'::public.org_role;
        WHEN 'user' THEN normalized_role := 'user'::public.org_role;
        ELSE
            RAISE EXCEPTION 'Invalid role: %. Must be one of: admin, editor, viewer, user', p_role
                USING ERRCODE = 'invalid_parameter_value';
    END CASE;
    
    -- Generate cryptographically strong random token
    invite_token := encode(gen_random_bytes(32), 'base64url');
    
    -- Set expiry to 7 days from now
    expiry_date := now() + interval '7 days';
    
    -- Create invitation
    INSERT INTO public.organization_invitations (
        organization_id,
        email,
        role,
        invited_by,
        status,
        invite_token,
        expires_at
    ) VALUES (
        p_org,
        lower(trim(p_email)),
        normalized_role,
        auth.uid(),
        'pending',
        invite_token,
        expiry_date
    ) RETURNING id INTO invitation_id;
    
    -- Return invitation details
    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', invitation_id,
        'token', invite_token,
        'expires_at', expiry_date,
        'organization_id', p_org,
        'email', lower(trim(p_email)),
        'role', normalized_role::text
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error details
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
END;
$function$;