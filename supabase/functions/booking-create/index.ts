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
  notes?: string;
}


serve(async (req) => {
  const traceId = generateTraceId();
  const origin = req.headers.get('origin');
  const responseCorsHeaders = getCorsHeaders(origin);

  // This function is now a stub for demo purposes

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

    // Demo stub - no actual booking integration needed

    // Demo stub - always return success without booking integration
    return new Response(
      JSON.stringify({ 
        ok: true, 
        booking: { 
          id: "demo-" + traceId,
          uid: "demo-" + traceId,
          attendee: body.attendee,
          start: body.start,
          end: body.end
        },
        traceId 
      }),
      { 
        status: 200, 
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
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