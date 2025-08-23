-- Create or replace the function that handles new user signup setup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_org_id uuid;
    sample_agent_id uuid;
BEGIN
    -- 1. Create profiles row (idempotent - only if doesn't exist)
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create organization (idempotent - only if user doesn't own one already)
    IF NOT EXISTS (
        SELECT 1 FROM public.organizations 
        WHERE owner_user_id = NEW.id
    ) THEN
        INSERT INTO public.organizations (name, owner_user_id)
        VALUES (
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)) || '''s Organization',
            NEW.id
        )
        RETURNING id INTO new_org_id;

        -- 3. Create organization_members row (admin role, seat active)
        INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
        VALUES (new_org_id, NEW.id, 'admin'::public.org_role, true)
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        -- 4. Seed one sample agent in draft status
        INSERT INTO public.agent_profiles (
            organization_id,
            name,
            system_prompt,
            voice,
            language,
            first_message_mode,
            first_message,
            retell_agent_id,
            status,
            is_default,
            warm_transfer_enabled,
            call_recording_enabled,
            max_tokens,
            temperature,
            settings
        ) VALUES (
            new_org_id,
            'Sales Assistant',
            'You are a helpful sales assistant. Be friendly, professional, and focus on understanding the customer''s needs. Always ask clarifying questions and provide helpful information about our products and services.',
            'rebecca',
            'en',
            'assistant_speaks',
            'Hello! I''m your AI sales assistant. How can I help you today?',
            'temp_' || encode(gen_random_bytes(8), 'hex'), -- Temporary ID until integrated with Retell
            'draft',
            true,
            false,
            true,
            1000,
            0.7,
            jsonb_build_object(
                'created_by_system', true,
                'sample_agent', true,
                'description', 'This is a sample agent to help you get started. You can edit or delete it anytime.'
            )
        );

        -- Log the organization creation activity
        INSERT INTO public.activity_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details
        ) VALUES (
            new_org_id,
            NEW.id,
            'organization_created',
            'organization',
            new_org_id,
            jsonb_build_object(
                'name', COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)) || '''s Organization',
                'setup_type', 'automatic_signup'
            )
        );

    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- Also create a manual function users can call to set up their account
-- if the trigger didn't run for some reason (idempotent)
CREATE OR REPLACE FUNCTION public.setup_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    current_user_id uuid;
    new_org_id uuid;
    result jsonb;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;

    -- Check if user already has a profile
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_user_id) THEN
        -- Get user details from auth.users
        INSERT INTO public.profiles (id, email, full_name)
        SELECT 
            id, 
            email, 
            COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1))
        FROM auth.users 
        WHERE id = current_user_id;
    END IF;

    -- Check if user already owns an organization
    SELECT id INTO new_org_id 
    FROM public.organizations 
    WHERE owner_user_id = current_user_id 
    LIMIT 1;

    IF new_org_id IS NULL THEN
        -- Create organization
        INSERT INTO public.organizations (name, owner_user_id)
        SELECT 
            COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1)) || '''s Organization',
            current_user_id
        FROM auth.users 
        WHERE id = current_user_id
        RETURNING id INTO new_org_id;

        -- Create organization membership
        INSERT INTO public.organization_members (organization_id, user_id, role, seat_active)
        VALUES (new_org_id, current_user_id, 'admin'::public.org_role, true)
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        -- Create sample agent if none exists
        IF NOT EXISTS (
            SELECT 1 FROM public.agent_profiles 
            WHERE organization_id = new_org_id
        ) THEN
            INSERT INTO public.agent_profiles (
                organization_id,
                name,
                system_prompt,
                voice,
                language,
                first_message_mode,
                first_message,
                retell_agent_id,
                status,
                is_default,
                warm_transfer_enabled,
                call_recording_enabled,
                max_tokens,
                temperature,
                settings
            ) VALUES (
                new_org_id,
                'Sales Assistant',
                'You are a helpful sales assistant. Be friendly, professional, and focus on understanding the customer''s needs.',
                'rebecca',
                'en',
                'assistant_speaks',
                'Hello! I''m your AI sales assistant. How can I help you today?',
                'temp_' || encode(gen_random_bytes(8), 'hex'),
                'draft',
                true,
                false,
                true,
                1000,
                0.7,
                jsonb_build_object(
                    'created_by_system', true,
                    'sample_agent', true
                )
            );
        END IF;

        result := jsonb_build_object(
            'success', true,
            'organization_id', new_org_id,
            'message', 'Account setup completed successfully'
        );
    ELSE
        result := jsonb_build_object(
            'success', true,
            'organization_id', new_org_id,
            'message', 'Account already set up'
        );
    END IF;

    RETURN result;
END;
$$;