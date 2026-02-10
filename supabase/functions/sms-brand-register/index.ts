import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireEntitlement } from '../_shared/entitlements.ts'
import { requireOrgIpAllowed, createIpBlockedResponse } from '../_shared/org-guard.ts'

interface BrandRegistrationRequest {
  brand_name: string
  company_name: string
  tax_id?: string
  website?: string
  industry?: string
  phone_number?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

    // Check IP allowlist
    const ipGuardResult = await requireOrgIpAllowed(req, membership.organization_id, supabaseClient)
    if (!ipGuardResult.ok) {
      const corr = crypto.randomUUID()
      console.log(`[${corr}] IP blocked for org ${membership.organization_id}: ${ipGuardResult.clientIp}`)
      return createIpBlockedResponse(ipGuardResult, corsHeaders, corr)
    }

    // Check SMS feature entitlement
    const corr = crypto.randomUUID()
    const gate = await requireEntitlement(supabaseClient, membership.organization_id, { feature: "sms" }, corr)
    if (!gate.ok) return new Response(JSON.stringify(gate.body), { status: gate.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const brandData: BrandRegistrationRequest = await req.json()

    // Validate required fields
    if (!brandData.brand_name || !brandData.company_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: brand_name, company_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if organization already has a brand registered
    const { data: existingBrand } = await supabaseClient
      .from('sms_brands')
      .select('id, registration_status')
      .eq('organization_id', membership.organization_id)
      .single()

    if (existingBrand) {
      return new Response(
        JSON.stringify({ 
          error: 'Organization already has a brand registered',
          existing_brand: existingBrand 
        }),
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

    let brandId = null
    let registrationStatus = 'pending'
    let rejectionReason = null

    try {
      // Submit brand registration to Retell API
      const retellResponse = await fetch('https://api.retellai.com/sms/brands', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand_name: brandData.brand_name,
          company_name: brandData.company_name,
          tax_id: brandData.tax_id,
          website: brandData.website,
          industry: brandData.industry,
          phone: brandData.phone_number,
          address: {
            line1: brandData.address_line1,
            line2: brandData.address_line2,
            city: brandData.city,
            state: brandData.state,
            postal_code: brandData.postal_code,
            country: brandData.country || 'US',
          },
        }),
      })

      const retellData = await retellResponse.json()

      if (retellResponse.ok) {
        brandId = retellData.brand_id
        registrationStatus = retellData.status || 'submitted'
      } else {
        console.error('Retell brand registration failed:', retellData)
        registrationStatus = 'failed'
        rejectionReason = retellData.error || 'API submission failed'
      }
    } catch (error) {
      console.error('Error submitting to Retell API:', error)
      registrationStatus = 'failed'
      rejectionReason = 'Network error during API submission'
    }

    // Store brand registration in database
    const { data: brand, error: insertError } = await supabaseClient
      .from('sms_brands')
      .insert({
        organization_id: membership.organization_id,
        brand_name: brandData.brand_name,
        company_name: brandData.company_name,
        tax_id: brandData.tax_id,
        website: brandData.website,
        industry: brandData.industry,
        phone_number: brandData.phone_number,
        address_line1: brandData.address_line1,
        address_line2: brandData.address_line2,
        city: brandData.city,
        state: brandData.state,
        postal_code: brandData.postal_code,
        country: brandData.country || 'US',
        registration_status: registrationStatus,
        brand_id: brandId,
        rejection_reason: rejectionReason,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to store brand registration:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store brand registration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        brand,
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