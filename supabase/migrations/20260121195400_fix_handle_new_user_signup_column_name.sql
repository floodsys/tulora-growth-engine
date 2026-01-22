-- ============================================================================
-- Migration: Fix handle_new_user_signup function to use user_id column
-- ============================================================================
-- Problem 1: The handle_new_user_signup function was inserting into profiles(id, ...)
-- but the profiles table PK column is now named user_id (not id).
-- This caused seed failures because the INSERT failed while the ON CONFLICT
-- clause correctly referenced user_id.
--
-- Problem 2: The organizations table had its updated_at column dropped in 
-- migration 20250823223017, but the trigger update_organizations_updated_at 
-- was not removed, causing errors on UPDATE.
-- 
-- This migration fixes both issues:
-- 1. Update handle_new_user_signup to use user_id column
-- 2. Remove the orphaned update_organizations_updated_at trigger
-- 
-- It is idempotent - safe to run on both new and existing databases.
-- ============================================================================

-- ============================================================================
-- Fix #1: Remove orphaned trigger on organizations table
-- ============================================================================
-- The updated_at column was dropped from organizations in migration 20250823223017,
-- but the trigger was not removed. This causes errors on UPDATE operations.

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_org_id uuid;
    org_name text;
    org_industry text;
    org_size text;
BEGIN
    -- Extract organization data from signup metadata
    org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 
                        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)) || '''s Organization');
    org_industry := NEW.raw_user_meta_data->>'industry';
    org_size := NEW.raw_user_meta_data->>'organization_size';

    -- 1. Create/update profiles row with complete information
    -- NOTE: Using user_id column (not id) - this is the correct column name after schema migration
    INSERT INTO public.profiles (
        user_id, 
        email, 
        full_name, 
        first_name,
        last_name,
        avatar_url,
        organization_name,
        organization_size,
        industry
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'avatar_url',
        org_name,
        org_size,
        org_industry
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        organization_name = COALESCE(EXCLUDED.organization_name, profiles.organization_name),
        organization_size = COALESCE(EXCLUDED.organization_size, profiles.organization_size),
        industry = COALESCE(EXCLUDED.industry, profiles.industry);

    -- 2. Create organization with complete details (idempotent - only if user doesn't own one already)
    IF NOT EXISTS (
        SELECT 1 FROM public.organizations 
        WHERE owner_user_id = NEW.id
    ) THEN
        INSERT INTO public.organizations (
            name, 
            owner_user_id,
            industry,
            size_band
        )
        VALUES (
            org_name,
            NEW.id,
            org_industry,
            org_size
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

    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- Ensure the trigger exists and uses the corrected function
-- ============================================================================
-- This is idempotent: DROP IF EXISTS + CREATE ensures the trigger is fresh.
-- Note: on_auth_user_created calls handle_new_user_signup
-- Note: on_auth_user_created_profile calls handle_new_user_profile (separate trigger)

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================================================
-- End of migration
-- ============================================================================
