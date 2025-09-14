import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface GenerateSignedUrlRequest {
  resource_type: 'recording' | 'transcript' | 'analysis'
  resource_id: string
  expires_in?: number // seconds, default 3600 (1 hour)
}

// Helper to create JWT token for signed URLs
async function createSignedToken(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  
  const textEncoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  
  const message = `${headerB64}.${payloadB64}`
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  
  return `${message}.${signatureB64}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user has org membership and appropriate role
    const { data: membership } = await supabaseClient
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('seat_active', true)
      .single()

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'No active organization membership' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { resource_type, resource_id, expires_in = 3600 }: GenerateSignedUrlRequest = await req.json()

    if (!resource_type || !resource_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: resource_type, resource_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify resource exists and user has access
    let resourceExists = false
    
    switch (resource_type) {
      case 'recording':
      case 'transcript':
      case 'analysis':
        const { data: call } = await supabaseClient
          .from('retell_calls')
          .select('id')
          .eq('call_id', resource_id)
          .eq('organization_id', membership.organization_id)
          .single()
        resourceExists = !!call
        break
    }

    if (!resourceExists) {
      return new Response(
        JSON.stringify({ error: 'Resource not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signed URL token
    const jwtSecret = Deno.env.get('JWT_SIGNING_SECRET')
    if (!jwtSecret) {
      console.error('JWT_SIGNING_SECRET not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expires_in
    const tokenPayload = {
      sub: user.id,
      org: membership.organization_id,
      resource_type,
      resource_id,
      role: membership.role,
      exp: expiresAt,
      iat: Math.floor(Date.now() / 1000)
    }

    const token = await createSignedToken(tokenPayload, jwtSecret)
    
    // Generate the signed URL
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '') || ''
    const signedUrl = `${baseUrl}/functions/v1/secure-resource-access?token=${token}&type=${resource_type}&id=${resource_id}`

    // Log access for audit
    await supabaseClient
      .from('audit_log')
      .insert({
        organization_id: membership.organization_id,
        actor_user_id: user.id,
        actor_role_snapshot: membership.role,
        action: 'resource.signed_url_generated',
        target_type: resource_type,
        target_id: resource_id,
        status: 'success',
        channel: 'audit',
        metadata: {
          expires_at: new Date(expiresAt * 1000).toISOString(),
          expires_in,
          resource_type,
          generated_at: new Date().toISOString()
        }
      })

    return new Response(
      JSON.stringify({
        signed_url: signedUrl,
        expires_at: new Date(expiresAt * 1000).toISOString(),
        expires_in
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating signed URL:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})