-- Create the create_invite RPC function
CREATE OR REPLACE FUNCTION public.create_invite(p_org uuid, p_email text, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Create the accept_invite RPC function
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    invitation_record record;
    current_user_id uuid;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated to accept invitations'
        );
    END IF;
    
    -- Find and validate invitation
    SELECT * INTO invitation_record
    FROM public.organization_invitations
    WHERE invite_token = p_token
      AND status = 'pending'
      AND expires_at > now();
    
    IF invitation_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid, expired, or already used invitation token'
        );
    END IF;
    
    -- Upsert into organization_members (handle conflicts)
    INSERT INTO public.organization_members (
        organization_id,
        user_id,
        role,
        seat_active
    ) VALUES (
        invitation_record.organization_id,
        current_user_id,
        invitation_record.role,
        true
    )
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET 
        role = EXCLUDED.role,
        seat_active = true;
    
    -- Mark invitation as accepted
    UPDATE public.organization_invitations
    SET status = 'accepted'
    WHERE id = invitation_record.id;
    
    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'organization_id', invitation_record.organization_id,
        'role', invitation_record.role::text,
        'message', 'Invitation accepted successfully'
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
$$;