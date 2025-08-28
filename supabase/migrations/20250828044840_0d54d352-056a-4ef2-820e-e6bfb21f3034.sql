-- Lock down voice_agents, call_logs, and bookings to admin-only access

-- Ensure RLS is enabled on all three tables
ALTER TABLE public.voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies on call_logs
DROP POLICY IF EXISTS "admin_access_call_logs" ON public.call_logs;

-- Drop existing permissive policies on bookings  
DROP POLICY IF EXISTS "admin_access_bookings" ON public.bookings;

-- Drop any existing permissive policies on voice_agents (if they exist)
DROP POLICY IF EXISTS "admin_access_voice_agents" ON public.voice_agents;
DROP POLICY IF EXISTS "voice_agents_public_access" ON public.voice_agents;

-- Create admin-only policies for voice_agents
CREATE POLICY "voice_agents_select_admin_only" 
ON public.voice_agents 
FOR SELECT 
USING (public.is_superadmin());

CREATE POLICY "voice_agents_insert_admin_only" 
ON public.voice_agents 
FOR INSERT 
WITH CHECK (public.is_superadmin());

CREATE POLICY "voice_agents_update_admin_only" 
ON public.voice_agents 
FOR UPDATE 
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

CREATE POLICY "voice_agents_delete_admin_only" 
ON public.voice_agents 
FOR DELETE 
USING (public.is_superadmin());

-- Create admin-only policies for call_logs
CREATE POLICY "call_logs_select_admin_only" 
ON public.call_logs 
FOR SELECT 
USING (public.is_superadmin());

CREATE POLICY "call_logs_insert_admin_only" 
ON public.call_logs 
FOR INSERT 
WITH CHECK (public.is_superadmin());

CREATE POLICY "call_logs_update_admin_only" 
ON public.call_logs 
FOR UPDATE 
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

CREATE POLICY "call_logs_delete_admin_only" 
ON public.call_logs 
FOR DELETE 
USING (public.is_superadmin());

-- Create admin-only policies for bookings
CREATE POLICY "bookings_select_admin_only" 
ON public.bookings 
FOR SELECT 
USING (public.is_superadmin());

CREATE POLICY "bookings_insert_admin_only" 
ON public.bookings 
FOR INSERT 
WITH CHECK (public.is_superadmin());

CREATE POLICY "bookings_update_admin_only" 
ON public.bookings 
FOR UPDATE 
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

CREATE POLICY "bookings_delete_admin_only" 
ON public.bookings 
FOR DELETE 
USING (public.is_superadmin());