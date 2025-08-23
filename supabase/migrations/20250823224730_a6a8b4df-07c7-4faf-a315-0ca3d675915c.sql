-- Create role enum if it doesn't exist (idempotent)
DO $$ BEGIN
    CREATE TYPE public.role AS ENUM ('admin', 'editor', 'viewer', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure organization_members.role uses the role enum
DO $$ BEGIN
    -- Check if column exists and is not already the correct type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_members' 
        AND column_name = 'role'
        AND data_type != 'USER-DEFINED'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_members' 
        AND column_name = 'role'
        AND data_type = 'USER-DEFINED'
        AND udt_name != 'role'
    ) THEN
        -- Normalize existing data first
        UPDATE public.organization_members 
        SET role = CASE 
            WHEN lower(role::text) IN ('owner', 'admin') THEN 'admin'
            WHEN lower(role::text) = 'editor' THEN 'editor'
            WHEN lower(role::text) = 'viewer' THEN 'viewer'
            ELSE 'user'
        END;
        
        -- Convert column to use role enum
        ALTER TABLE public.organization_members 
        ALTER COLUMN role TYPE public.role USING 
        CASE 
            WHEN lower(role::text) IN ('owner', 'admin') THEN 'admin'::public.role
            WHEN lower(role::text) = 'editor' THEN 'editor'::public.role
            WHEN lower(role::text) = 'viewer' THEN 'viewer'::public.role
            ELSE 'user'::public.role
        END;
    END IF;
END $$;

-- Ensure organization_invitations.role uses the role enum
DO $$ BEGIN
    -- Check if column exists and is not already the correct type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_invitations' 
        AND column_name = 'role'
        AND data_type != 'USER-DEFINED'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_invitations' 
        AND column_name = 'role'
        AND data_type = 'USER-DEFINED'
        AND udt_name != 'role'
    ) THEN
        -- Normalize existing data first
        UPDATE public.organization_invitations 
        SET role = CASE 
            WHEN lower(role::text) IN ('owner', 'admin') THEN 'admin'
            WHEN lower(role::text) = 'editor' THEN 'editor'
            WHEN lower(role::text) = 'viewer' THEN 'viewer'
            ELSE 'user'
        END;
        
        -- Convert column to use role enum
        ALTER TABLE public.organization_invitations 
        ALTER COLUMN role TYPE public.role USING 
        CASE 
            WHEN lower(role::text) IN ('owner', 'admin') THEN 'admin'::public.role
            WHEN lower(role::text) = 'editor' THEN 'editor'::public.role
            WHEN lower(role::text) = 'viewer' THEN 'viewer'::public.role
            ELSE 'user'::public.role
        END;
    END IF;
END $$;

-- Normalize any remaining data to ensure consistency (idempotent)
UPDATE public.organization_members 
SET role = 'admin'::public.role 
WHERE role::text IN ('owner', 'Owner', 'OWNER', 'admin', 'Admin', 'ADMIN')
AND role != 'admin'::public.role;

UPDATE public.organization_invitations 
SET role = 'admin'::public.role 
WHERE role::text IN ('owner', 'Owner', 'OWNER', 'admin', 'Admin', 'ADMIN')
AND role != 'admin'::public.role;

-- Also normalize any legacy data in memberships table if it exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships') THEN
        UPDATE public.memberships 
        SET role = 'admin' 
        WHERE role IN ('owner', 'Owner', 'OWNER');
    END IF;
END $$;