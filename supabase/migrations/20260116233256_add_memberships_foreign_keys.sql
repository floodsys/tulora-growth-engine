-- Add memberships foreign keys after referenced tables exist

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memberships_organization_id_fkey'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memberships_user_id_fkey'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;
