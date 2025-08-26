-- Fix duplicate foreign key constraints between organization_members and organizations
-- Drop duplicate foreign key constraints, keeping only the canonical one

-- First, check and drop any duplicate constraints
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Get all foreign key constraints pointing from organization_members to organizations
    -- Keep only the canonical 'organization_members_organization_id_fkey'
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'organization_members'::regclass 
          AND confrelid = 'organizations'::regclass
          AND conname != 'organization_members_organization_id_fkey'
          AND contype = 'f'  -- foreign key constraints only
    LOOP
        EXECUTE format('ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped duplicate foreign key constraint: %', constraint_name;
    END LOOP;
    
    -- Ensure the canonical foreign key exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'organization_members_organization_id_fkey'
          AND conrelid = 'organization_members'::regclass
          AND confrelid = 'organizations'::regclass
    ) THEN
        ALTER TABLE organization_members 
        ADD CONSTRAINT organization_members_organization_id_fkey 
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added canonical foreign key constraint';
    END IF;
END $$;