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

  const corr = crypto.randomUUID();

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set')

    // Detect Stripe key mode
    const isLiveKey = stripeKey.startsWith('sk_live_')
    console.log('[checkout:start]', { corr, isLiveKey })

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

    let { orgId, planKey }: CheckoutRequest = await req.json()
    
    // Early capture of key context for debugging
    let priceId: string | undefined = undefined;
    console.log('[checkout:request]', { corr, orgId, planKey })

    // Require non-empty orgId with fallback
    if (!orgId || orgId.trim() === '') {
      // Try to get user's default organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_org_id')
        .eq('user_id', userData.user.id)
        .single()
      
      if (profile?.current_org_id) {
        orgId = profile.current_org_id
        logStep('Using fallback orgId from profile', { orgId })
      } else {
        // Check if user has any org memberships
        const { data: memberships } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userData.user.id)
          .eq('seat_active', true)
          .limit(1)
        
        if (memberships?.[0]?.organization_id) {
          orgId = memberships[0].organization_id
          logStep('Using fallback orgId from membership', { orgId })
        } else {
          console.log('[checkout:error]', { corr, error: 'ORG_ID_MISSING', orgId, planKey, priceId })
          return new Response(JSON.stringify({ 
            error: 'Organization ID required',
            code: 'ORG_ID_MISSING',
            hint: 'Select an organization before checkout.',
            correlationId: corr,
            context: { orgId, planKey, stripeMode: isLiveKey ? 'live' : 'test' }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
      }
    }

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
    priceId = planConfig.stripe_price_id_monthly
    console.log('[checkout:plan-resolved]', { corr, orgId, planKey, priceId, productLine: planConfig.product_line })
    const isDevelopment = Deno.env.get('NODE_ENV') !== 'production'
    
    // Verify plan & price mapping before creating a Session
    if (!priceId && !isDevelopment) {
      console.log('[checkout:error]', { corr, error: 'PRICE_NOT_CONFIGURED', orgId, planKey, priceId })
      return new Response(JSON.stringify({
        error: 'Price not configured',
        code: 'PRICE_NOT_CONFIGURED',
        hint: 'Configure live Price ID in Admin → Stripe Configuration.',
        correlationId: corr,
        context: { orgId, planKey, priceId, stripeMode: isLiveKey ? 'live' : 'test' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Verify price exists in Stripe if we have a priceId
    if (priceId) {
      try {
        await stripe.prices.retrieve(priceId)
        logStep('Verified price exists in Stripe', { priceId })
      } catch (stripeError: any) {
        if (stripeError.code === 'resource_missing') {
          console.log('[checkout:error]', { corr, error: 'NO_SUCH_PRICE', orgId, planKey, priceId, stripeError: stripeError.message })
          return new Response(JSON.stringify({
            error: 'Price ID not found',
            code: 'NO_SUCH_PRICE',
            hint: 'Price ID and Stripe key are in different modes (test vs live).',
            correlationId: corr,
            context: { orgId, planKey, priceId, stripeMode: isLiveKey ? 'live' : 'test' }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
        throw stripeError // Re-throw other Stripe errors
      }
    }

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
    
    // Consistent metadata for reconciliation
    const metadata = {
      org_id: orgId,
      plan_key: planKey,
      product_line: planConfig.product_line,
      organization_id: orgId // Keep both for compatibility
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: orgId, // For reliable org mapping
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${appOrigin}/dashboard?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/dashboard?checkout_canceled=true`,
      metadata,
      subscription_data: {
        metadata
      }
    })

    console.log('[checkout:success]', { corr, sessionId: session.id, orgId, planKey, priceId })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log('[checkout:error]', { corr, error: errorMessage, orgId, planKey, priceId })
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: 'INTERNAL_ERROR',
      correlationId: corr,
      context: { orgId, planKey, priceId }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})