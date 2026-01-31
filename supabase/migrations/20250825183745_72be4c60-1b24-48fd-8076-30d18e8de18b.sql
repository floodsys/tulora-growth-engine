-- Insert your actual user ID into superadmins table (only if user exists in auth.users)
INSERT INTO public.superadmins (user_id)
SELECT 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid)
ON CONFLICT (user_id) DO NOTHING;

-- Verify superadmin status (only if user exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid) THEN
    RAISE NOTICE 'Superadmin status for a2e9b538-5c1d-44be-a752-960a69e6f164: %', 
      public.is_superadmin('a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid);
  ELSE
    RAISE NOTICE 'User a2e9b538-5c1d-44be-a752-960a69e6f164 does not exist yet - skipping superadmin verification';
  END IF;
END;
$$;
