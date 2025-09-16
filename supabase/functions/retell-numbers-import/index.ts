import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireEntitlement, getCurrentCount, getEntitlementsForOrg } from '../_shared/entitlements.ts'

interface ImportNumberRequest {
  e164: string
  country?: string
  byoc_provider: string
  sms_enabled?: boolean
  sip_config?: {
    sip_domain: string
    sip_username?: string
    auth_username?: string
    auth_password?: string
    trunk_name?: string
    caller_id_name?: string
    caller_id_number?: string
    codec_preferences?: string[]
    dtmf_mode?: 'rfc2833' | 'inband' | 'info'
    registration_required?: boolean
    outbound_proxy?: string
    custom_headers?: Record<string, string>
  }
  network_config?: {
    ip_whitelist?: string[]
    port_range?: string
    protocol?: 'udp' | 'tcp' | 'tls'
    nat_traversal?: boolean
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's organization
    const { data: membership } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('seat_active', true)
      .single()

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'No active organization membership' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check numbers feature and limit entitlements
    const corr = crypto.randomUUID()
    const g1 = await requireEntitlement(supabaseClient, membership.organization_id, { feature: "numbers" }, corr)
    if (!g1.ok) return new Response(JSON.stringify(g1.body), { status: g1.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Parse request body first to determine how many numbers are being imported
    const requestData: ImportNumberRequest = await req.json()

    // Determine requested count - for single number import this is 1, but structured for future bulk support
    const requestedCount = 1 // Single number import for now

    // Check if import would exceed limit
    const currentCount = await getCurrentCount(supabaseClient, membership.organization_id, "numbers")
    const entitlementsResult = await getEntitlementsForOrg(supabaseClient, membership.organization_id, corr)
    
    if (entitlementsResult.ok) {
      const limit = entitlementsResult.entitlements.limits.numbers
      const remaining = limit === null ? Infinity : Math.max(0, limit - currentCount)
      if (limit !== null && currentCount + requestedCount > limit) {
        const body = {
          code: "LIMIT_REACHED_NUMBERS",
          message: `Import exceeds plan limit (${limit}).`,
          hint: `You can import up to ${remaining} more number${remaining === 1 ? "" : "s"} or upgrade your plan.`,
          corr
        }
        return new Response(JSON.stringify(body), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Validate required fields
    if (!requestData.e164 || !requestData.byoc_provider) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: e164 and byoc_provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if number already exists for this organization
    const { data: existingNumber } = await supabaseClient
      .from('retell_numbers')
      .select('id')
      .eq('e164', requestData.e164)
      .eq('organization_id', membership.organization_id)
      .eq('is_active', true)
      .single()

    if (existingNumber) {
      return new Response(
        JSON.stringify({ error: 'Number already imported for this organization' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a unique number_id for BYOC numbers
    const numberId = `byoc_${crypto.randomUUID()}`

    // Store the imported number in our database
    const { data: dbNumber, error: dbError } = await supabaseClient
      .from('retell_numbers')
      .insert({
        organization_id: membership.organization_id,
        number_id: numberId,
        e164: requestData.e164,
        country: requestData.country || 'US',
        is_active: true,
        sms_enabled: requestData.sms_enabled || false,
        is_byoc: true,
        byoc_provider: requestData.byoc_provider,
        metadata: {
          imported_at: new Date().toISOString(),
          imported_by: user.id,
          sip_config: requestData.sip_config || {},
          network_config: requestData.network_config || {},
          enterprise_verified: true
        }
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to import number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        number: dbNumber
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})