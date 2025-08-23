-- Fix security warnings - Add search_path to existing functions

-- Fix existing functions that lack search_path
CREATE OR REPLACE FUNCTION public.normalize_role_value(input_role text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Convert to lowercase and normalize
    CASE lower(trim(input_role))
        WHEN 'owner' THEN RETURN 'admin';
        WHEN 'admin' THEN RETURN 'admin';
        WHEN 'editor' THEN RETURN 'editor';
        WHEN 'viewer' THEN RETURN 'viewer';
        WHEN 'user' THEN RETURN 'user';
        ELSE RAISE EXCEPTION 'Invalid role: %. Must be one of: admin, editor, viewer, user', input_role;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_role_constraint(role_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN lower(trim(role_value)) IN ('admin', 'editor', 'viewer', 'user');
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_normalize_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Note: This function may need adjustment since org_role enum might not exist yet
    -- For now, we'll work with text values
    NEW.role := normalize_role_value(NEW.role::text);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_single_default_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If setting this agent as default, unset all other defaults for this org
  IF NEW.is_default = true THEN
    UPDATE public.agent_profiles 
    SET is_default = false 
    WHERE organization_id = NEW.organization_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  
  RETURN NEW;
END;
$$;