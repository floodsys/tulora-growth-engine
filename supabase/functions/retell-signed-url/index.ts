import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { callId, organizationId, resourceType, expirationHours = 24 } = await req.json()

    // Get call data to verify access
    const { data: call, error: callError } = await supabase
      .from('retell_calls')
      .select('recording_signed_url, organization_id')
      .eq('call_id', callId)
      .eq('organization_id', organizationId)
      .single()

    if (callError || !call) {
      throw new Error('Call not found or access denied')
    }

    // Get agent privacy settings
    const { data: agent, error: agentError } = await supabase
      .from('retell_agents')
      .select('settings')
      .eq('organization_id', organizationId)
      .single()

    const privacySettings = agent?.settings?.privacySettings
    const useSecureUrls = privacySettings?.useSecureUrls ?? true
    const urlExpirationHours = privacySettings?.urlExpirationHours ?? 24

    if (!useSecureUrls) {
      // Return the original URL if secure URLs are disabled
      return new Response(JSON.stringify({
        signed_url: call.recording_signed_url,
        expires_at: null,
        secure: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate signed URL with expiration
    const expirationTime = new Date()
    expirationTime.setHours(expirationTime.getHours() + urlExpirationHours)

    // For demo purposes, we'll create a signed URL structure
    // In a real implementation, you'd integrate with your storage provider (S3, etc.)
    const signedUrl = `${call.recording_signed_url}?expires=${expirationTime.getTime()}&signature=${generateSignature(callId, expirationTime)}`

    // Log access for audit purposes
    await supabase
      .from('audit_log')
      .insert({
        organization_id: organizationId,
        action: 'recording.access',
        target_type: 'call_recording',
        target_id: callId,
        status: 'success',
        channel: 'audit',
        metadata: {
          resource_type: resourceType,
          signed_url_generated: true,
          expires_at: expirationTime.toISOString(),
          expiration_hours: urlExpirationHours
        }
      })

    return new Response(JSON.stringify({
      signed_url: signedUrl,
      expires_at: expirationTime.toISOString(),
      secure: true,
      expiration_hours: urlExpirationHours
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in retell-signed-url:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Simple signature generation for demo purposes
function generateSignature(callId: string, expirationTime: Date): string {
  const secret = Deno.env.get('JWT_SECRET') || 'default-secret'
  const data = `${callId}:${expirationTime.getTime()}`
  
  // In a real implementation, use proper HMAC-SHA256
  const encoder = new TextEncoder()
  const dataArray = encoder.encode(data + secret)
  
  // Simple hash for demo
  let hash = 0
  for (let i = 0; i < dataArray.length; i++) {
    hash = ((hash << 5) - hash + dataArray[i]) & 0xffffffff
  }
  
  return Math.abs(hash).toString(16)
}