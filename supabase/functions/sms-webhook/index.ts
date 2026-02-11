import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { timingSafeEqual } from 'https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

async function computeTwilioSignature(
  authToken: string, 
  url: string, 
  params: Record<string, string>
): Promise<string> {
  // Sort params alphabetically and concatenate
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}${params[key]}`)
    .join('')
  
  const data = url + sortedParams
  
  // HMAC-SHA1
  const encoder = new TextEncoder()
  const keyData = encoder.encode(authToken)
  const msgData = encoder.encode(data)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, msgData)
  
  // Base64 encode
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

serve(async (req) => {
  const corsHeaders = { ...getCorsHeaders(req), 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const corr = crypto.randomUUID()
  
  try {
    // Get exact URL (no trailing slash variance)
    const baseUrl = Deno.env.get('TWILIO_WEBHOOK_BASE_URL')
    if (!baseUrl) {
      console.error(`[${corr}] TWILIO_WEBHOOK_BASE_URL not configured`)
      return new Response(JSON.stringify({ 
        error: 'Configuration error',
        corr
      }), { status: 500, headers: corsHeaders })
    }
    
    const verificationUrl = `${baseUrl}/sms-webhook`  // No trailing slash on baseUrl
    
    // Parse form data
    const formData = await req.formData()
    const params: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString()
    }
    
    // Timing-safe signature verification
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    if (!authToken) {
      console.error(`[${corr}] TWILIO_AUTH_TOKEN not configured`)
      return new Response(JSON.stringify({ 
        error: 'Configuration error',
        corr
      }), { status: 500, headers: corsHeaders })
    }
    
    const expectedSig = req.headers.get('X-Twilio-Signature') || ''
    const computedSig = await computeTwilioSignature(authToken, verificationUrl, params)
    
    const expected = new TextEncoder().encode(expectedSig)
    const computed = new TextEncoder().encode(computedSig)
    
    if (expected.length !== computed.length || !timingSafeEqual(expected, computed)) {
      console.warn(`[${corr}] Invalid Twilio signature`)
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        corr
      }), { status: 401, headers: corsHeaders })
    }
    
    // Process SMS
    const { From, To, Body } = params
    console.log(`[${corr}] SMS received:`, { from: From, to: To, body: Body?.substring(0, 50) })
    
    // Store in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )
    
    const { error } = await supabase
      .from('sms_messages')
      .insert({
        from_number: From,
        to_number: To,
        body: Body,
        raw_params: params,
        received_at: new Date().toISOString()
      })
    
    if (error) {
      console.error(`[${corr}] Failed to store SMS:`, error)
      // Don't fail the webhook even if storage fails
    }
    
    // Respond with empty TwiML
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        } 
      }
    )
  } catch (error) {
    console.error(`[${corr}] SMS webhook error:`, error)
    return new Response(JSON.stringify({ 
      error: 'Internal error',
      corr
    }), { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})
