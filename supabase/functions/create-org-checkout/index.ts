import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
  planKey: string
  interval: 'monthly'
  orgId: string
  seats?: number
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ORG-CHECKOUT] ${step}${detailsStr}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logStep('Function started')

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header provided')

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) throw new Error('User not authenticated')

    const { planKey, interval, orgId, seats }: CheckoutRequest = await req.json()
    const finalSeats = seats || 1
    logStep('Request data', { planKey, interval, orgId, seats: finalSeats })

    // Verify user has admin access to this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userData.user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions')
    }

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('name, stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (!org) throw new Error('Organization not found')

    // Get plan configuration
    const { data: planConfig, error: planError } = await supabase
      .from('plan_configs')
      .select('*')
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .single()

    if (planError || !planConfig) {
      throw new Error(`Plan ${planKey} not found or inactive`)
    }

    logStep('Found plan config', { 
      planKey, 
      productLine: planConfig.product_line,
      hasSetupFee: !!planConfig.stripe_setup_price_id 
    })

    // Validate interval and get price ID
    if (interval !== 'monthly') {
      throw new Error('Only monthly interval is currently supported')
    }

    const priceId = planConfig.stripe_price_id_monthly
    if (!priceId) {
      throw new Error(`No monthly Stripe price ID configured for plan ${planKey}`)
    }

    logStep('Using subscription price ID', { planKey, priceId })

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Create or get Stripe customer
    let customerId = org.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { org_id: orgId }
      })
      customerId = customer.id
      
      // Update org with customer ID
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId)
      
      logStep('Created new Stripe customer', { customerId })
    }

    // Prepare line items for checkout
    const lineItems = [{
      price: priceId,
      quantity: finalSeats,
    }]

    // Add setup fee as one-time item if configured
    if (planConfig.stripe_setup_price_id) {
      lineItems.push({
        price: planConfig.stripe_setup_price_id,
        quantity: 1,
      })
      logStep('Adding setup fee', { setupPriceId: planConfig.stripe_setup_price_id })
    }

    // Create checkout session
    const origin = req.headers.get('origin') || 'http://localhost:3000'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: orgId, // For reliable org mapping
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${origin}/dashboard?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?checkout_canceled=true`,
      metadata: {
        organization_id: orgId,
        plan_key: planKey,
        product_line: planConfig.product_line,
        seats: finalSeats.toString(),
        interval: interval
      },
      subscription_data: {
        metadata: {
          organization_id: orgId,
          plan_key: planKey,
          product_line: planConfig.product_line,
          seats: finalSeats.toString()
        }
      }
    })

    logStep('Checkout session created', { sessionId: session.id, url: session.url })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('ERROR', { message: errorMessage })
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})