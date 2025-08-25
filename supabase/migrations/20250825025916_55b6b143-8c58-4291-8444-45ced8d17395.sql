-- Simplify the handle_new_user_signup function by removing the problematic activity logging
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

        -- 4. Seed one sample agent with 'active' status
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
            'temp_' || encode(extensions.gen_random_bytes(8), 'hex'),
            'active',
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

        -- Note: Skipping activity logging for now to avoid column mismatch issues
        -- The signup process is more important than the initial activity log

    END IF;

    RETURN NEW;
END;
$function$;