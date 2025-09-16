import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireEntitlement } from '../_shared/entitlements.ts'

interface CampaignRegistrationRequest {
  brand_id: string
  campaign_name: string
  campaign_type?: string
  use_case: string
  sample_messages: string[]
  monthly_volume?: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    // Check SMS feature entitlement
    const corr = crypto.randomUUID()
    const entitlementCheck = await requireEntitlement(
      supabaseClient,
      membership.organization_id,
      { feature: 'sms' },
      corr
    )

    if (!entitlementCheck.success) {
      console.log(`[${corr}] SMS campaign registration denied:`, entitlementCheck.error)
      return new Response(
        JSON.stringify(entitlementCheck.error),
        { 
          status: entitlementCheck.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const campaignData: CampaignRegistrationRequest = await req.json()

    // Validate required fields
    if (!campaignData.brand_id || !campaignData.campaign_name || !campaignData.use_case || !campaignData.sample_messages?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: brand_id, campaign_name, use_case, sample_messages' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify brand belongs to organization
    const { data: brand } = await supabaseClient
      .from('sms_brands')
      .select('id, brand_id, registration_status')
      .eq('id', campaignData.brand_id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found or does not belong to your organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (brand.registration_status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Brand must be approved before registering campaigns' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Retell API key for submission
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()
    if (!retellApiKey) {
      return new Response(
        JSON.stringify({ error: 'Retell API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let campaignId = null
    let registrationStatus = 'pending'
    let rejectionReason = null

    try {
      // Submit campaign registration to Retell API
      const retellResponse = await fetch('https://api.retellai.com/sms/campaigns', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand_id: brand.brand_id,
          campaign_name: campaignData.campaign_name,
          campaign_type: campaignData.campaign_type || 'standard',
          use_case: campaignData.use_case,
          sample_messages: campaignData.sample_messages,
          monthly_volume: campaignData.monthly_volume || 1000,
        }),
      })

      const retellData = await retellResponse.json()

      if (retellResponse.ok) {
        campaignId = retellData.campaign_id
        registrationStatus = retellData.status || 'submitted'
      } else {
        console.error('Retell campaign registration failed:', retellData)
        registrationStatus = 'failed'
        rejectionReason = retellData.error || 'API submission failed'
      }
    } catch (error) {
      console.error('Error submitting to Retell API:', error)
      registrationStatus = 'failed'
      rejectionReason = 'Network error during API submission'
    }

    // Store campaign registration in database
    const { data: campaign, error: insertError } = await supabaseClient
      .from('sms_campaigns')
      .insert({
        organization_id: membership.organization_id,
        brand_id: campaignData.brand_id,
        campaign_name: campaignData.campaign_name,
        campaign_type: campaignData.campaign_type || 'standard',
        use_case: campaignData.use_case,
        sample_messages: campaignData.sample_messages,
        monthly_volume: campaignData.monthly_volume || 1000,
        registration_status: registrationStatus,
        campaign_id: campaignId,
        rejection_reason: rejectionReason,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to store campaign registration:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store campaign registration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign,
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