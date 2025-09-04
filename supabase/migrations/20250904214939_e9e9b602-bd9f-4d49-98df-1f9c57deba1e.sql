-- Enable real-time updates for organizations table
ALTER TABLE public.organizations REPLICA IDENTITY FULL;

-- Add the organizations table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;