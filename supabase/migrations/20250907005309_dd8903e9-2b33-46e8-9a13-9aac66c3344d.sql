-- Harden the is_superadmin function as single source of truth
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  -- Use provided user_id or fall back to auth.uid()
  uid := COALESCE(user_id, auth.uid());
  
  -- Return false if no user ID available
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user exists in superadmins table (single source of truth)
  RETURN EXISTS (
    SELECT 1 FROM public.superadmins s 
    WHERE s.user_id = uid
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;

-- Ensure the function owner can read the superadmins table
GRANT SELECT ON public.superadmins TO postgres;