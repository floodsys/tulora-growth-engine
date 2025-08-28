-- Update booking_config for voice agents with specific eventTypeIds

-- Update Paul (Real Estate) booking config
UPDATE public.voice_agents 
SET booking_config = jsonb_build_object(
  'eventTypeId', 999999,  -- Replace with actual CAL_EVENT_TYPE_ID_REAL_ESTATE
  'timezone', COALESCE(booking_config->>'timezone', 'America/Toronto')
)
WHERE slug = 'paul';

-- Update Laura (Restaurant) booking config  
UPDATE public.voice_agents 
SET booking_config = jsonb_build_object(
  'eventTypeId', 999998,  -- Replace with actual CAL_EVENT_TYPE_ID_RESTAURANT
  'timezone', COALESCE(booking_config->>'timezone', 'America/Toronto')
)
WHERE slug = 'laura';

-- Update Jessica (Healthcare) booking config
UPDATE public.voice_agents 
SET booking_config = jsonb_build_object(
  'eventTypeId', 999997,  -- Replace with actual CAL_EVENT_TYPE_ID_HEALTHCARE
  'timezone', COALESCE(booking_config->>'timezone', 'America/Toronto')
)
WHERE slug = 'jessica';

-- Ensure all agents have booking_provider set if not already
UPDATE public.voice_agents 
SET booking_provider = COALESCE(booking_provider, 'caldotcom')
WHERE slug IN ('paul', 'laura', 'jessica') AND booking_provider IS NULL;