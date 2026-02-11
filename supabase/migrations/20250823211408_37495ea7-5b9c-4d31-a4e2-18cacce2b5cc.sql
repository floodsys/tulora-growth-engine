-- This migration is now a no-op.
-- The role enum migration was already handled by 20250823211335 using org_role enum.
-- Keeping this file empty to maintain migration history.

-- Note: The original content tried to use public.role enum but the correct enum is public.org_role
-- which was created and used by earlier migrations.

SELECT 1; -- No-op statement to make this a valid migration
