import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Helper to verify JWT token
async function verifySignedToken(token: string, secret: string): Promise<any> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [headerB64, payloadB64, signatureB64] = parts
  
  // Verify signature
  const textEncoder = new TextEncoder()
  const message = `${headerB64}.${payloadB64}`
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  
  const expectedSignature = new Uint8Array(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(c => c.charCodeAt(0))
  )
  
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    expectedSignature,
    textEncoder.encode(message)
  )
  
  if (!isValid) {
    throw new Error('Invalid token signature')
  }
  
  // Decode payload
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
  
  // Check expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  
  return payload
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const resourceType = url.searchParams.get('type')
    const resourceId = url.searchParams.get('id')

    if (!token || !resourceType || !resourceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT token
    const jwtSecret = Deno.env.get('JWT_SIGNING_SECRET')
    if (!jwtSecret) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let payload
    try {
      payload = await verifySignedToken(token, jwtSecret)
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate token claims
    if (payload.resource_type !== resourceType || payload.resource_id !== resourceId) {
      return new Response(
        JSON.stringify({ error: 'Token does not match requested resource' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role for secure access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch resource data
    let resourceData
    let contentType = 'application/json'
    
    switch (resourceType) {
      case 'recording':
        const { data: call } = await supabaseClient
          .from('retell_calls')
          .select('recording_signed_url, call_id')
          .eq('call_id', resourceId)
          .eq('organization_id', payload.org)
          .single()
        
        if (!call?.recording_signed_url) {
          return new Response(
            JSON.stringify({ error: 'Recording not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Proxy the recording URL
        const recordingResponse = await fetch(call.recording_signed_url)
        if (!recordingResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Recording unavailable' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        contentType = recordingResponse.headers.get('content-type') || 'audio/mpeg'
        const recordingData = await recordingResponse.arrayBuffer()
        
        // Log access
        await supabaseClient
          .from('audit_log')
          .insert({
            organization_id: payload.org,
            actor_user_id: payload.sub,
            actor_role_snapshot: payload.role,
            action: 'resource.recording_accessed',
            target_type: 'recording',
            target_id: resourceId,
            status: 'success',
            channel: 'audit',
            metadata: {
              access_method: 'signed_url',
              accessed_at: new Date().toISOString()
            }
          })
        
        return new Response(recordingData, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="recording_${resourceId}.mp3"`
          }
        })
        
      case 'transcript':
        const { data: transcriptCall } = await supabaseClient
          .from('retell_calls')
          .select('transcript_summary, call_id')
          .eq('call_id', resourceId)
          .eq('organization_id', payload.org)
          .single()
        
        if (!transcriptCall) {
          return new Response(
            JSON.stringify({ error: 'Transcript not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        resourceData = {
          call_id: transcriptCall.call_id,
          transcript: transcriptCall.transcript_summary,
          generated_at: new Date().toISOString()
        }
        break
        
      case 'analysis':
        const { data: analysisCall } = await supabaseClient
          .from('retell_calls')
          .select('analysis_json, call_id, sentiment, outcome, topics, tags')
          .eq('call_id', resourceId)
          .eq('organization_id', payload.org)
          .single()
        
        if (!analysisCall) {
          return new Response(
            JSON.stringify({ error: 'Analysis not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        resourceData = {
          call_id: analysisCall.call_id,
          analysis: analysisCall.analysis_json,
          sentiment: analysisCall.sentiment,
          outcome: analysisCall.outcome,
          topics: analysisCall.topics,
          tags: analysisCall.tags,
          generated_at: new Date().toISOString()
        }
        break
        
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid resource type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Log access for non-recording resources
    if (resourceType !== 'recording') {
      await supabaseClient
        .from('audit_log')
        .insert({
          organization_id: payload.org,
          actor_user_id: payload.sub,
          actor_role_snapshot: payload.role,
          action: `resource.${resourceType}_accessed`,
          target_type: resourceType,
          target_id: resourceId,
          status: 'success',
          channel: 'audit',
          metadata: {
            access_method: 'signed_url',
            accessed_at: new Date().toISOString()
          }
        })
    }

    return new Response(
      JSON.stringify(resourceData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error accessing secure resource:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})