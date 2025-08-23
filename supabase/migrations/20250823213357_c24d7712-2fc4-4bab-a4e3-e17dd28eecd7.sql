-- Fix infinite recursion in RLS policies by updating security definer functions

-- Drop and recreate is_org_admin function with better implementation
DROP FUNCTION IF EXISTS public.is_org_admin(uuid);

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user is organization owner
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id 
        AND owner_user_id = auth.uid()
    ) THEN true
    -- Check if user is admin member
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND role = 'admin' 
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$$;

-- Drop and recreate is_org_member function with better implementation
DROP FUNCTION IF EXISTS public.is_org_member(uuid);

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user is organization owner
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = org_id 
        AND owner_user_id = auth.uid()
    ) THEN true
    -- Check if user is an active member
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = org_id 
        AND user_id = auth.uid() 
        AND seat_active = true
    ) THEN true
    ELSE false
  END;
$$;

-- Backfill missing owner_user_id values from existing admin members
-- Choose the oldest admin member for deterministic selection
UPDATE public.organizations 
SET owner_user_id = (
  SELECT om.user_id 
  FROM public.organization_members om
  WHERE om.organization_id = organizations.id
    AND om.role = 'admin'
    AND om.seat_active = true
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE owner_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organizations.id
      AND om.role = 'admin'
      AND om.seat_active = true
  );

-- Add a comment explaining the backfill logic
COMMENT ON COLUMN public.organizations.owner_user_id IS 'Organization owner user ID. Nullable for historical reasons. When null, admin members have owner privileges. Backfilled from oldest admin member when possible.';