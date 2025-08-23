-- Add entitlements field to organizations table for caching price metadata
ALTER TABLE public.organizations 
ADD COLUMN entitlements JSONB DEFAULT '{}'::jsonb;