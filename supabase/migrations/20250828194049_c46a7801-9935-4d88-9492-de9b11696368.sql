-- Drop Cal.com database artifacts
-- This migration removes booking-related tables and columns

-- Drop the bookings table if it exists
DROP TABLE IF EXISTS public.bookings CASCADE;

-- Remove booking-related columns from voice_agents table
ALTER TABLE public.voice_agents DROP COLUMN IF EXISTS booking_provider;
ALTER TABLE public.voice_agents DROP COLUMN IF EXISTS booking_config;

-- Drop any RLS policies that might have referenced the bookings table
-- (The CASCADE on DROP TABLE should handle most of these automatically)