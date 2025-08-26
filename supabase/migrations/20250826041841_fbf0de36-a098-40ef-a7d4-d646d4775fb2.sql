-- Fix remaining parameter shadowing issues found in old migrations
-- These are old migration artifacts, but we should clean them up for consistency

-- First, check if any of these old functions still exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND prosrc LIKE '%user_id = user_id%';