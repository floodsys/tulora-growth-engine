import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get allowed origins from environment
const allowedOrigins = [
  Deno.env.get('VITE_APP_URL'),
  Deno.env.get('PROJECT_URL'),
  'https://nkjxbeypbiclvouqfjyc.supabase.co', // Project URL
].filter(Boolean);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be overridden per request
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
  };
}

interface BookingRequest {
  agentSlug: string;
  attendee: {
    name: string;
    phone?: string;
    email?: string;
  };
  start: string; // ISO8601
  end: string; // ISO8601
  eventTypeId?: number;
  notes?: string;
}

interface CalBookingRequest {
  eventTypeId: number;
  start: string;
  end: string;
  responses: {
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
  };
}

serve(async (req) => {
  const traceId = generateTraceId();
  const origin = req.headers.get('origin');
  const responseCorsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: responseCorsHeaders });
  }

  // Method guard - enforce POST only
  if (req.method !== 'POST') {
    console.log(`[${traceId}] Method not allowed: ${req.method}`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed', traceId }),
      { 
        status: 405, 
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // CORS origin validation
  if (origin && !allowedOrigins.includes(origin)) {
    console.log(`[${traceId}] Origin not allowed: ${origin}`);
    return new Response(
      JSON.stringify({ error: 'Origin not allowed', traceId }),
      { 
        status: 403, 
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.log(`[${traceId}] Invalid content type: ${contentType}`);
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse and validate request body
    const body: BookingRequest = await req.json();
    
    if (!body.agentSlug || !body.attendee?.name || !body.start || !body.end) {
      console.log(`[${traceId}] Missing required fields - agentSlug: ${!!body.agentSlug}, attendee.name: ${!!body.attendee?.name}, start: ${!!body.start}, end: ${!!body.end}`);
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agentSlug, attendee.name, start, end', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate agent slug
    const validSlugs = ['paul', 'laura', 'jessica'];
    if (!validSlugs.includes(body.agentSlug.toLowerCase())) {
      console.log(`[${traceId}] Invalid agentSlug: ${body.agentSlug}`);
      return new Response(
        JSON.stringify({ error: 'Invalid agentSlug. Must be one of: paul, laura, jessica', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate ISO8601 dates
    const startDate = new Date(body.start);
    const endDate = new Date(body.end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.log(`[${traceId}] Invalid date format - start: ${body.start}, end: ${body.end}`);
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use ISO8601 format', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (endDate <= startDate) {
      console.log(`[${traceId}] Invalid date range - end time must be after start time`);
      return new Response(
        JSON.stringify({ error: 'End time must be after start time', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get environment variables
    const calApiKey = Deno.env.get('CAL_API_KEY');
    const defaultEventTypeId = Deno.env.get('CAL_DEFAULT_EVENT_TYPE_ID');
    
    if (!calApiKey) {
      console.error(`[${traceId}] CAL_API_KEY not configured`);
      return new Response(
        JSON.stringify({ error: 'Service configuration error', traceId }),
        { 
          status: 500, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine eventTypeId based on priority
    let eventTypeId = body.eventTypeId;
    let agentId: string | null = null;

    if (!eventTypeId) {
      // Try to get from voice_agents table
      const { data: agent, error: agentError } = await supabase
        .from('voice_agents')
        .select('id, booking_config')
        .eq('slug', body.agentSlug)
        .maybeSingle();

      if (agentError) {
        console.error(`[${traceId}] Error fetching agent: ${agentError.message}`);
      } else if (agent?.booking_config?.eventTypeId) {
        eventTypeId = agent.booking_config.eventTypeId;
        agentId = agent.id;
      }
    }

    if (!eventTypeId && defaultEventTypeId) {
      eventTypeId = parseInt(defaultEventTypeId);
    }

    if (!eventTypeId) {
      console.log(`[${traceId}] No eventTypeId available for agent: ${body.agentSlug}`);
      return new Response(
        JSON.stringify({ error: 'No eventTypeId available. Provide in request or configure default', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare Cal.com API request
    const calPayload: CalBookingRequest = {
      eventTypeId: eventTypeId,
      start: body.start,
      end: body.end,
      responses: {
        name: body.attendee.name,
        ...(body.attendee.email && { email: body.attendee.email }),
        ...(body.attendee.phone && { phone: body.attendee.phone }),
        ...(body.notes && { notes: body.notes }),
      },
    };

    console.log(`[${traceId}] Creating Cal.com booking for agent ${body.agentSlug}, eventTypeId: ${eventTypeId}`);

    // Create booking via Cal.com API
    const calResponse = await fetch('https://api.cal.com/v1/bookings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${calApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(calPayload),
    });

    if (!calResponse.ok) {
      const errorText = await calResponse.text();
      console.error(`[${traceId}] Cal.com API error: ${calResponse.status} - ${errorText.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ error: 'Upstream service error', traceId }),
        { 
          status: 502, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const calBookingData = await calResponse.json();
    
    // Insert booking record into database
    const { data: bookingRecord, error: insertError } = await supabase
      .from('bookings')
      .insert({
        agent_id: agentId,
        cal_booking_id: calBookingData.id?.toString() || calBookingData.uid,
        attendee_name: body.attendee.name,
        attendee_phone: body.attendee.phone || null,
        attendee_email: body.attendee.email || null,
        time_start: body.start,
        time_end: body.end,
        payload: calBookingData,
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${traceId}] Error inserting booking record: ${insertError.message}`);
      // Log the error but don't fail the request since Cal.com booking was successful
    }

    console.log(`[${traceId}] Booking created successfully for agent: ${body.agentSlug}`);

    return new Response(
      JSON.stringify({
        ok: true,
        booking: {
          id: calBookingData.id || calBookingData.uid,
          status: calBookingData.status,
          eventTypeId: eventTypeId,
          attendee: body.attendee.name,
          start: body.start,
          end: body.end,
        },
        traceId
      }),
      {
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error(`[${traceId}] Error in booking-create function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error', traceId }),
      {
        status: 500,
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});