-- Fix critical security vulnerability: Restrict membership insertions
-- Remove overly permissive policy that allows any user to join any org
DROP POLICY IF EXISTS "Users can create memberships" ON public.memberships;

-- Create secure membership invitation system
-- Only org admins can invite new members
CREATE POLICY "Org admins can invite members" 
ON public.memberships 
FOR INSERT 
TO authenticated
WITH CHECK (is_org_admin(organization_id));

-- Create policy for users to accept invitations (status update only)
CREATE POLICY "Users can accept invitations" 
ON public.memberships 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status IN ('active', 'declined'));

-- Ensure profiles table has proper trigger for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Ensure trigger exists for new user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();