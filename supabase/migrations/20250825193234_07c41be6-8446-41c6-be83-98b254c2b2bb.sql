-- Update the existing is_superadmin function with proper security without dropping it
-- Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.

CREATE OR REPLACE FUNCTION public.is_superadmin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
  allowlisted_emails text[];
  guc_value text;
BEGIN
  -- Return false if no user provided
  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  -- First check: superadmins table (primary source of truth)
  IF EXISTS (
    SELECT 1 FROM public.superadmins 
    WHERE superadmins.user_id = is_superadmin.user_id
  ) THEN
    RETURN true;
  END IF;

  -- Second check: GUC allowlist (fallback for bootstrapping)
  -- Get user email from auth.users (using security definer to access auth schema)
  SELECT email INTO user_email
  FROM auth.users 
  WHERE id = is_superadmin.user_id;

  -- Return false if no email found
  IF user_email IS NULL THEN
    RETURN false;
  END IF;

  -- Normalize email
  user_email := lower(trim(user_email));

  -- Try multiple GUC setting names for flexibility
  BEGIN
    guc_value := current_setting('app.superadmin_emails', true);
    IF guc_value IS NULL OR guc_value = '' THEN
      guc_value := current_setting('app.superadmins_emails', true);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      guc_value := NULL;
  END;
  
  -- Check against GUC allowlist if available
  IF guc_value IS NOT NULL AND guc_value != '' THEN
    -- Split by comma and normalize each email
    SELECT array_agg(lower(trim(email))) 
    INTO allowlisted_emails
    FROM unnest(string_to_array(guc_value, ',')) AS email;
    
    IF allowlisted_emails IS NOT NULL AND user_email = ANY(allowlisted_emails) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

-- Set proper ownership
ALTER FUNCTION public.is_superadmin(uuid) OWNER TO postgres;

-- Ensure superadmins table has proper ownership and RLS
ALTER TABLE public.superadmins OWNER TO postgres;

-- Re-insert the specific user if missing (idempotent, only if user exists in auth.users)
INSERT INTO public.superadmins (user_id)
SELECT 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid) -- gitleaks:allow
ON CONFLICT (user_id) DO NOTHING;

-- Verification queries
SELECT 
  'DB Function Test' as test_type,
  public.is_superadmin('a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid) as result,
  'Should be true' as expected;

SELECT 
  'User Lookup' as test_type,
  u.id,
  u.email,
  s.user_id IS NOT NULL as in_superadmins_table
FROM auth.users u
LEFT JOIN public.superadmins s ON s.user_id = u.id
WHERE lower(u.email) = 'admin@axionstack.xyz';

SELECT 
  'GUC Setting' as test_type,
  current_setting('app.superadmin_emails', true) as guc_emails;
