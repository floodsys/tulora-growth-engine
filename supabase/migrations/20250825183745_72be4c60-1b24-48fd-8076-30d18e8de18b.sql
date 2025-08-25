-- Insert your actual user ID into superadmins table (now that account exists)
INSERT INTO public.superadmins (user_id)
VALUES ('a2e9b538-5c1d-44be-a752-960a69e6f164')
ON CONFLICT (user_id) DO NOTHING;

-- Verify superadmin status
SELECT 
  public.is_superadmin('a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid) as is_superadmin_check,
  'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid as user_id,
  (SELECT email FROM auth.users WHERE id = 'a2e9b538-5c1d-44be-a752-960a69e6f164'::uuid) as email;