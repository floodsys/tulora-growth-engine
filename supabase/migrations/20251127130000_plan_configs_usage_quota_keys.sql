-- Migration: Add usage quota keys documentation for plan_configs.limits
-- 
-- This migration documents the extended schema for plan_configs.limits JSONB column
-- to support usage-based quotas in addition to resource counts.
--
-- The limits JSONB can now contain the following keys:
--   Resource Limits (existing):
--     - agents: number | null         -- Max active agents (null = unlimited)
--     - numbers: number | null        -- Max phone numbers (null = unlimited)  
--     - widgets: number | null        -- Max web widgets (null = unlimited)
--     - seats: number | null          -- Max team seats (null = unlimited)
--     - storage_gb: number | null     -- Storage allocation in GB (null = unlimited)
--
--   Usage Quotas (new, optional - absence means "not enforced"):
--     - calls_per_month: number | null    -- Max outbound/inbound calls per billing cycle
--     - minutes_per_month: number | null  -- Max call minutes per billing cycle
--     - messages_per_month: number | null -- Max SMS/chat messages per billing cycle
--
-- Note: null values indicate "unlimited", while missing keys mean "not enforced"
-- This allows plans to selectively enforce certain quotas without requiring all keys.

-- Add a comment to the limits column documenting the expected schema
COMMENT ON COLUMN public.plan_configs.limits IS 
'JSON object containing plan limits and usage quotas. Keys:
  Resource limits: agents, numbers, widgets, seats, storage_gb
  Usage quotas: calls_per_month, minutes_per_month, messages_per_month
  Values: number (limit) | null (unlimited). Missing keys = not enforced.';

-- Example: Update a free/trial plan to have low usage quotas (if it exists)
-- This is a sample that can be adjusted based on your actual plan keys
UPDATE public.plan_configs
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(limits, '{}'::jsonb),
      '{calls_per_month}', '100'::jsonb
    ),
    '{minutes_per_month}', '50'::jsonb
  ),
  '{messages_per_month}', '50'::jsonb
)
WHERE plan_key = 'trial' 
  AND (limits->>'calls_per_month') IS NULL;

-- For starter-tier plans, set moderate quotas
UPDATE public.plan_configs  
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(limits, '{}'::jsonb),
      '{calls_per_month}', '1000'::jsonb
    ),
    '{minutes_per_month}', '500'::jsonb
  ),
  '{messages_per_month}', '500'::jsonb
)
WHERE plan_key IN ('leadgen_starter', 'support_starter')
  AND (limits->>'calls_per_month') IS NULL;

-- For business-tier plans, set higher quotas  
UPDATE public.plan_configs
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(limits, '{}'::jsonb),
      '{calls_per_month}', '5000'::jsonb
    ),
    '{minutes_per_month}', '2500'::jsonb
  ),
  '{messages_per_month}', '2500'::jsonb
)
WHERE plan_key IN ('leadgen_business', 'support_business')
  AND (limits->>'calls_per_month') IS NULL;

-- Enterprise plans get null (unlimited) for usage quotas
UPDATE public.plan_configs
SET limits = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(limits, '{}'::jsonb),
      '{calls_per_month}', 'null'::jsonb
    ),
    '{minutes_per_month}', 'null'::jsonb
  ),
  '{messages_per_month}', 'null'::jsonb
)
WHERE plan_key IN ('leadgen_enterprise', 'support_enterprise', 'business')
  AND (limits->>'calls_per_month') IS NULL;
