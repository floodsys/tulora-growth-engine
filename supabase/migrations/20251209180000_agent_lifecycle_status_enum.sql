-- Migration: Implement Agent Lifecycle State Machine
-- States: DRAFT, TESTING, ACTIVE, PAUSED, ARCHIVED
-- 
-- This migration:
-- 1. Updates existing status values to new uppercase format
-- 2. Adds a CHECK constraint for valid status values
-- 3. Adds status tracking columns

-- First, migrate existing data to new status values
UPDATE public.retell_agents 
SET status = CASE 
  WHEN LOWER(status) = 'draft' THEN 'DRAFT'
  WHEN LOWER(status) = 'published' THEN 'ACTIVE'  -- 'published' becomes 'ACTIVE'
  ELSE 'DRAFT'  -- Unknown values default to DRAFT
END
WHERE status IS NOT NULL;

-- Add CHECK constraint for valid status values
-- Drop existing constraint if it exists
ALTER TABLE public.retell_agents 
DROP CONSTRAINT IF EXISTS valid_agent_status;

-- Add new constraint with all 5 lifecycle states
ALTER TABLE public.retell_agents 
ADD CONSTRAINT valid_agent_status 
CHECK (status IN ('DRAFT', 'TESTING', 'ACTIVE', 'PAUSED', 'ARCHIVED'));

-- Update default value to uppercase
ALTER TABLE public.retell_agents 
ALTER COLUMN status SET DEFAULT 'DRAFT';

-- Add columns for status tracking if they don't exist
ALTER TABLE public.retell_agents 
ADD COLUMN IF NOT EXISTS testing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Backfill activated_at from published_at for ACTIVE agents
UPDATE public.retell_agents 
SET activated_at = published_at 
WHERE status = 'ACTIVE' AND published_at IS NOT NULL AND activated_at IS NULL;

-- Drop old index if exists and create new one
DROP INDEX IF EXISTS idx_retell_agents_status;
CREATE INDEX idx_retell_agents_status ON public.retell_agents(status) WHERE is_active = true;

-- Create partial indexes for common status queries
CREATE INDEX IF NOT EXISTS idx_retell_agents_active_status 
ON public.retell_agents(organization_id, status) 
WHERE status = 'ACTIVE' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_retell_agents_testing_status 
ON public.retell_agents(organization_id, status) 
WHERE status = 'TESTING' AND is_active = true;

-- Add comment documenting the status values
COMMENT ON COLUMN public.retell_agents.status IS 
'Agent lifecycle status: DRAFT (configuring), TESTING (internal test calls), ACTIVE (production), PAUSED (disabled), ARCHIVED (read-only)';
