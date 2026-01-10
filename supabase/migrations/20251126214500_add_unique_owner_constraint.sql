-- Add UNIQUE constraint on owner_user_id to prevent duplicate primary orgs
-- This ensures one owner can only have one primary organization

-- First, handle any existing duplicates by keeping only the oldest org per owner
-- (This is a safety measure in case there are already duplicates in production)
DO $$
DECLARE
    dup_owner uuid;
    keep_org_id uuid;
BEGIN
    -- Find owners with multiple organizations
    FOR dup_owner IN 
        SELECT owner_user_id 
        FROM public.organizations 
        WHERE owner_user_id IS NOT NULL 
        GROUP BY owner_user_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the oldest organization (by created_at)
        SELECT id INTO keep_org_id
        FROM public.organizations
        WHERE owner_user_id = dup_owner
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- For other orgs owned by this user, set owner_user_id to NULL
        -- (they become orphaned but we preserve the data)
        UPDATE public.organizations
        SET owner_user_id = NULL
        WHERE owner_user_id = dup_owner
          AND id != keep_org_id;
          
        RAISE NOTICE 'Deduplicated orgs for owner %, kept org %', dup_owner, keep_org_id;
    END LOOP;
END $$;

-- Now add the unique constraint
ALTER TABLE public.organizations
ADD CONSTRAINT organizations_owner_user_id_unique UNIQUE (owner_user_id);

-- Add an index for faster lookups (the unique constraint creates one, but let's be explicit)
CREATE INDEX IF NOT EXISTS idx_organizations_owner_user_id 
ON public.organizations(owner_user_id) 
WHERE owner_user_id IS NOT NULL;

COMMENT ON CONSTRAINT organizations_owner_user_id_unique ON public.organizations IS 
'Ensures each user can only own one primary organization. Enforces idempotent org creation.';
