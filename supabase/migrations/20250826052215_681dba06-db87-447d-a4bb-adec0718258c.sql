-- Make the current user an org admin (enum-safe)
-- Ensure org_role enum includes admin and update membership

DO $$
DECLARE
    current_user_id uuid;
    user_org_id uuid;
    current_role text;
BEGIN
    -- Get the current authenticated user ID
    current_user_id := 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid;
    
    -- Find the organization this user owns or is a member of
    SELECT id INTO user_org_id
    FROM public.organizations 
    WHERE owner_user_id = current_user_id
    LIMIT 1;
    
    IF user_org_id IS NULL THEN
        -- If not an owner, find first organization they're a member of
        SELECT organization_id INTO user_org_id
        FROM public.organization_members 
        WHERE user_id = current_user_id
        LIMIT 1;
    END IF;
    
    IF user_org_id IS NOT NULL THEN
        -- Check current role
        SELECT role::text INTO current_role
        FROM public.organization_members 
        WHERE organization_id = user_org_id AND user_id = current_user_id;
        
        RAISE NOTICE 'Current role for user % in org %: %', current_user_id, user_org_id, COALESCE(current_role, 'NO MEMBERSHIP');
        
        -- Upsert membership record with admin role and active seat
        INSERT INTO public.organization_members (
            organization_id, 
            user_id, 
            role, 
            seat_active
        ) VALUES (
            user_org_id,
            current_user_id,
            'admin'::org_role,
            true
        )
        ON CONFLICT (organization_id, user_id) 
        DO UPDATE SET 
            role = 'admin'::org_role,
            seat_active = true;
            
        RAISE NOTICE 'Updated user % in organization % to admin role with active seat', current_user_id, user_org_id;
        
        -- Verify the update
        SELECT role::text INTO current_role
        FROM public.organization_members 
        WHERE organization_id = user_org_id AND user_id = current_user_id;
        
        RAISE NOTICE 'Verified new role: %', current_role;
    ELSE
        RAISE NOTICE 'No organization found for user %', current_user_id;
    END IF;
END $$;