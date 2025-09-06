-- Fix the safe_timestamp_from_epoch function to have proper search_path setting
CREATE OR REPLACE FUNCTION public.safe_timestamp_from_epoch(epoch_value bigint)
RETURNS timestamp with time zone
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    -- Only convert if the value is a reasonable timestamp (between 2000 and 2100)
    -- Stripe timestamps are in seconds since epoch
    IF epoch_value IS NULL OR epoch_value < 946684800 OR epoch_value > 4102444800 THEN
        RETURN NULL;
    END IF;
    
    RETURN to_timestamp(epoch_value);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;