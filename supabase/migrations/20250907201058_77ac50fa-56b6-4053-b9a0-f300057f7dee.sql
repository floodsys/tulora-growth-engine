-- Deactivate Core plans by setting is_active=false
UPDATE public.plan_configs 
SET is_active = false, updated_at = now()
WHERE product_line = 'core' OR plan_key IN ('trial', 'free');