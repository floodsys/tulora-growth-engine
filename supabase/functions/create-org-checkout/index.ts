import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
  orgId: string
  planKey: string
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

    const { orgId, planKey }: CheckoutRequest = await req.json()
    logStep('Request data', { orgId, planKey })

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
      productLine: planConfig.product_line
    })

    // Use monthly subscription price
    const priceId = planConfig.stripe_price_id_monthly
    const isDevelopment = Deno.env.get('NODE_ENV') !== 'production'
    
    if (!priceId && !isDevelopment) {
      throw new Error(`No monthly Stripe price ID configured for plan ${planKey}`)
    }

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

    // Prepare line items - subscription + optional setup fee
    let lineItems;
    
    if (priceId) {
      // Use configured Stripe Price ID
      logStep('Using configured subscription price ID', { planKey, priceId })
      lineItems = [{
        price: priceId,
        quantity: 1, // Default to 1 seat, can be adjusted later via Stripe portal
      }];
    } else if (isDevelopment) {
      // Dev-only fallback: create dynamic test price
      logStep('Using dynamic test price for dev environment', { planKey })
      lineItems = [{
        price_data: {
          currency: 'usd',
          unit_amount: 1000, // $10.00 test price
          recurring: {
            interval: 'month'
          },
          product_data: {
            name: `${planKey} (Test)`
          }
        },
        quantity: 1
      }];
    }

    // Add setup fee if enabled and configured
    if (planConfig.bill_setup_fee_in_stripe && planConfig.stripe_setup_price_id) {
      logStep('Adding setup fee to checkout', { setupPriceId: planConfig.stripe_setup_price_id });
      lineItems.push({
        price: planConfig.stripe_setup_price_id,
        quantity: 1
      });
    } else if (planConfig.bill_setup_fee_in_stripe && !planConfig.stripe_setup_price_id) {
      logStep('Setup fee billing enabled but no setup price ID configured', { planKey });
    }

    // Get APP_ORIGIN for success/cancel URLs
    const appOrigin = Deno.env.get('APP_ORIGIN') || req.headers.get('origin') || 'http://localhost:3000'
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: orgId, // For reliable org mapping
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${appOrigin}/dashboard?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/dashboard?checkout_canceled=true`,
      metadata: {
        organization_id: orgId,
        plan_key: planKey,
        product_line: planConfig.product_line
      },
      subscription_data: {
        metadata: {
          organization_id: orgId,
          plan_key: planKey,
          product_line: planConfig.product_line
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