-- Update booking_config with real Cal.com eventTypeIds

-- Update Paul (Real Estate) with real eventTypeId
UPDATE public.voice_agents 
SET booking_config = booking_config || jsonb_build_object('eventTypeId', 3182184)
WHERE slug = 'paul';

-- Update Laura (Restaurant) with real eventTypeId  
UPDATE public.voice_agents 
SET booking_config = booking_config || jsonb_build_object('eventTypeId', 3182183)
WHERE slug = 'laura';

-- Update Jessica (Healthcare) with real eventTypeId
UPDATE public.voice_agents 
SET booking_config = booking_config || jsonb_build_object('eventTypeId', 3182186)
WHERE slug = 'jessica';