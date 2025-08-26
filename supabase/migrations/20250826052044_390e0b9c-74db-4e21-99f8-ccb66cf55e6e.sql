-- Activate seat for the current user in their organization
-- This ensures the user has an active seat for organization access

DO $$
DECLARE
    current_user_id uuid;
    user_org_id uuid;
BEGIN
    -- Get the current authenticated user ID (this will be the superadmin)
    current_user_id := 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid;
    
    -- Find the organization this user owns
    SELECT id INTO user_org_id
    FROM public.organizations 
    WHERE owner_user_id = current_user_id
    LIMIT 1;
    
    IF user_org_id IS NOT NULL THEN
        -- Upsert membership record with active seat
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
            seat_active = true,
            role = 'admin'::org_role;
            
        RAISE NOTICE 'Activated seat for user % in organization %', current_user_id, user_org_id;
    ELSE
        RAISE NOTICE 'No organization found for user %', current_user_id;
    END IF;
END $$;