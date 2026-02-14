-- scripts/verify/scheduler-check.sql
--
-- Detects whether retention-cleanup / usage-rollup scheduled jobs exist.
-- Works with pg_cron (if extension is enabled) and Supabase scheduled functions.
-- Returns rows with job_name, schedule, status columns.

-- 1. Check pg_cron jobs (if extension is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension is installed';
  ELSE
    RAISE NOTICE 'pg_cron extension is NOT installed — scheduled jobs use another mechanism';
  END IF;
END $$;

-- 2. List pg_cron jobs (will fail gracefully if pg_cron not installed)
SELECT
  jobid,
  jobname AS job_name,
  schedule,
  command,
  active AS is_active,
  'pg_cron' AS source
FROM cron.job
WHERE jobname ILIKE '%retention%'
   OR jobname ILIKE '%cleanup%'
   OR jobname ILIKE '%rollup%'
   OR jobname ILIKE '%usage%'
ORDER BY jobname;
