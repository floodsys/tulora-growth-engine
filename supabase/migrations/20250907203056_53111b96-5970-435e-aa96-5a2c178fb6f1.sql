-- Permanently remove Core plan definitions
-- This migration removes all plan configurations with product_line in ('core', 'archived_core')

-- Delete all Core and archived Core plan configurations
DELETE FROM plan_configs 
WHERE product_line IN ('core', 'archived_core');