-- SECURITY FIX: Enable Row Level Security on memberships_deprecated_legacy table
-- This table was missing RLS despite having policies defined, creating a security vulnerability
-- where user membership data was publicly accessible

ALTER TABLE public.memberships_deprecated_legacy ENABLE ROW LEVEL SECURITY;