import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

serve(async (req) => {
  const traceId = generateTraceId();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Method guard - enforce POST only
  if (req.method !== 'POST') {
    console.log(`[${traceId}] Method not allowed: ${req.method}`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed', traceId }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (endDate <= startDate) {
      console.log(`[${traceId}] Invalid date range - end time must be after start time`);
      return new Response(
        JSON.stringify({ error: 'End time must be after start time', traceId }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client for optional demo booking storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Insert demo booking record into database
        const { error: insertError } = await supabase
          .from('bookings')
          .insert({
            agent_id: null, // No agent ID for demo bookings
            cal_booking_id: `demo_${traceId}`,
            attendee_name: body.attendee.name,
            attendee_phone: body.attendee.phone || null,
            attendee_email: body.attendee.email || null,
            time_start: body.start,
            time_end: body.end,
            payload: {
              source: 'demo',
              traceId,
              originalRequest: body
            },
          });

        if (insertError) {
          console.error(`[${traceId}] Error inserting demo booking record: ${insertError.message}`);
          // Continue anyway since this is just demo data
        } else {
          console.log(`[${traceId}] Demo booking record created successfully`);
        }
      } catch (error) {
        console.error(`[${traceId}] Error with demo booking storage: ${error.message}`);
        // Continue anyway since this is just demo data
      }
    }

    console.log(`[${traceId}] Demo booking created successfully for agent: ${body.agentSlug}`);

    // Return a canned success response
    return new Response(
      JSON.stringify({
        ok: true,
        booking: {
          id: `demo_${traceId}`,
          status: 'confirmed',
          eventTypeId: body.eventTypeId || 999999,
          attendee: body.attendee.name,
          start: body.start,
          end: body.end,
          source: 'demo'
        },
        traceId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error(`[${traceId}] Error in booking-create-stub function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error', traceId }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});