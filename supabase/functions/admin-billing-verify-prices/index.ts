import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface PriceVerificationResult {
  plan_key: string
  price_id: string
  ok: boolean
  error?: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-BILLING-VERIFY-PRICES] ${step}${detailsStr}`);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logStep('Function started')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Verify admin access
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Check if user is superadmin (DB RPC is source of truth)
    const { data: isSuperadmin, error: superadminError } = await supabase.rpc('is_superadmin', { user_id: userData.user.id })

    if (superadminError) {
      throw superadminError
    }

    if (!isSuperadmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    logStep('Admin access verified', { userId: userData.user.id })

    // Get Stripe key and determine mode
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const isLiveKey = stripeKey.startsWith('sk_live_')
    const mode = isLiveKey ? 'live' : 'test'
    logStep('Stripe mode detected', { mode })

    // Query all plan configs with price IDs
    const { data: planConfigs, error: planError } = await supabase
      .from('plan_configs')
      .select('plan_key, stripe_price_id_monthly, stripe_setup_price_id')
      .not('stripe_price_id_monthly', 'is', null)

    if (planError) {
      throw planError
    }

    logStep('Found plan configs', { count: planConfigs?.length })

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const results: PriceVerificationResult[] = []

    // Verify each price ID
    for (const config of planConfigs || []) {
      if (config.stripe_price_id_monthly) {
        try {
          await stripe.prices.retrieve(config.stripe_price_id_monthly)
          results.push({
            plan_key: config.plan_key,
            price_id: config.stripe_price_id_monthly,
            ok: true
          })
          logStep('Price verification success', {
            planKey: config.plan_key,
            priceId: config.stripe_price_id_monthly
          })
        } catch (stripeError: any) {
          const errorMessage = stripeError.code === 'resource_missing'
            ? 'Price not found (likely wrong mode or invalid ID)'
            : stripeError.message || 'Unknown Stripe error'

          results.push({
            plan_key: config.plan_key,
            price_id: config.stripe_price_id_monthly,
            ok: false,
            error: errorMessage
          })
          logStep('Price verification failed', {
            planKey: config.plan_key,
            priceId: config.stripe_price_id_monthly,
            error: errorMessage
          })
        }
      }

      // Also verify setup fee price if present
      if (config.stripe_setup_price_id) {
        try {
          await stripe.prices.retrieve(config.stripe_setup_price_id)
          results.push({
            plan_key: `${config.plan_key}_setup`,
            price_id: config.stripe_setup_price_id,
            ok: true
          })
        } catch (stripeError: any) {
          const errorMessage = stripeError.code === 'resource_missing'
            ? 'Setup price not found (likely wrong mode or invalid ID)'
            : stripeError.message || 'Unknown Stripe error'

          results.push({
            plan_key: `${config.plan_key}_setup`,
            price_id: config.stripe_setup_price_id,
            ok: false,
            error: errorMessage
          })
        }
      }
    }

    const response = {
      mode,
      results,
      summary: {
        total: results.length,
        verified: results.filter(r => r.ok).length,
        failed: results.filter(r => !r.ok).length
      }
    }

    logStep('Verification complete', response.summary)

    return new Response(JSON.stringify(response), {
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