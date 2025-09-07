-- Fix the search path security warnings for the new functions
ALTER FUNCTION public.safe_stripe_timestamp(BIGINT) SET search_path = public;
ALTER FUNCTION public.compute_org_entitlements(UUID) SET search_path = public;  
ALTER FUNCTION public.refresh_organization_billing_summary(UUID) SET search_path = public;