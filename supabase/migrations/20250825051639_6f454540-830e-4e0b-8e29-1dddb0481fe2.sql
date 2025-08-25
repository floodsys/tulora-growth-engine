-- Add organization profile fields
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS size_band TEXT;

-- Add check constraint for size_band values
ALTER TABLE public.organizations 
ADD CONSTRAINT organizations_size_band_check 
CHECK (size_band IS NULL OR size_band IN ('1-10', '11-50', '51-200', '201-1000', '1000+'));

-- Create function to check if user is org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
      AND user_id = auth.uid() 
      AND role = 'admin'::org_role 
      AND seat_active = true
  );
$$;