-- Create profiles table if it doesn't exist, then update structure
-- This migration is idempotent

-- First create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    email text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add new columns to profiles table (idempotent)
DO $$
BEGIN
    -- Add first_name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name') THEN
        ALTER TABLE public.profiles ADD COLUMN first_name text;
    END IF;
    
    -- Add last_name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_name') THEN
        ALTER TABLE public.profiles ADD COLUMN last_name text;
    END IF;
    
    -- Add organization_name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_name') THEN
        ALTER TABLE public.profiles ADD COLUMN organization_name text;
    END IF;
    
    -- Add organization_size if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_size') THEN
        ALTER TABLE public.profiles ADD COLUMN organization_size text;
    END IF;
    
    -- Add industry if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'industry') THEN
        ALTER TABLE public.profiles ADD COLUMN industry text;
    END IF;
END $$;

-- Handle the id -> user_id column rename (only if id exists and user_id doesn't)
DO $$
BEGIN
    -- Check if we need to rename id to user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
        -- Drop old primary key
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
        -- Rename column
        ALTER TABLE public.profiles RENAME COLUMN id TO user_id;
        -- Add new primary key
        ALTER TABLE public.profiles ADD PRIMARY KEY (user_id);
        RAISE NOTICE 'Renamed id column to user_id';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
        RAISE NOTICE 'user_id column already exists';
    END IF;
    
    -- Add foreign key constraint if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_user_id_fkey' 
          AND table_schema = 'public' 
          AND table_name = 'profiles'
    ) THEN
        -- Only add if we have user_id column
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
            ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey 
              FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
            RAISE NOTICE 'Added profiles_user_id_fkey constraint';
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not complete column rename: %', SQLERRM;
END $$;

-- Drop existing RLS policies (safe to drop even if they don't exist)
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create comprehensive RLS policies
-- Get the primary key column name dynamically
DO $$
DECLARE
    pk_column text;
BEGIN
    -- Determine which column is the primary key (id or user_id)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
        pk_column := 'user_id';
    ELSE
        pk_column := 'id';
    END IF;
    
    -- Create policies using EXECUTE for dynamic column name
    EXECUTE format('CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = %I)', pk_column);
    EXECUTE format('CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = %I) WITH CHECK (auth.uid() = %I)', pk_column, pk_column);
    EXECUTE format('CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = %I)', pk_column);
    
    RAISE NOTICE 'Created RLS policies using column: %', pk_column;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Policies already exist';
END $$;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    pk_col text;
BEGIN
    -- Check which column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
        INSERT INTO public.profiles (user_id, full_name, email)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.email
        )
        ON CONFLICT (user_id) DO NOTHING;
    ELSE
        INSERT INTO public.profiles (id, full_name, email)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.email
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger for auto-creating profiles on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();
