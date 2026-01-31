-- Ensure superadmins table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.superadmins (
  user_id uuid PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  added_by uuid,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on superadmins table if not already enabled
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- Insert your account as superadmin (idempotent)
INSERT INTO public.superadmins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'admin@axionstack.xyz'
ON CONFLICT (user_id) DO NOTHING;

-- Set database GUC for fallback allowlist (safely skip if not permitted in local env)
DO $$
BEGIN
  EXECUTE 'ALTER DATABASE postgres SET app.superadmin_emails = ''admin@axionstack.xyz''';
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  -- Local Supabase may not allow custom GUC parameters; this is expected
  RAISE NOTICE 'Skipping GUC parameter setting - not permitted in this environment';
END;
$$;

-- Reload configuration (safely skip if not permitted)
DO $$
BEGIN
  PERFORM pg_reload_conf();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping pg_reload_conf - not permitted in this environment';
END;
$$;

-- Verify superadmin status
SELECT 
  public.is_superadmin((SELECT id FROM auth.users WHERE lower(email)='admin@axionstack.xyz')) as is_superadmin_check,
  (SELECT id FROM auth.users WHERE lower(email)='admin@axionstack.xyz') as user_id,
  (SELECT email FROM auth.users WHERE lower(email)='admin@axionstack.xyz') as email;
