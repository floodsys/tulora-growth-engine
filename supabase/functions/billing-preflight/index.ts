import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PreflightRequest {
  orgId: string
  planKey: string
}

interface CheckResult {
  id: string
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  hint?: string
  details?: any
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const corr = crypto.randomUUID()
  let stripeMode = 'unknown'
  let orgId: string | undefined
  let planKey: string | undefined

  try {
    console.log('[billing-preflight:start]', { corr })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication required',
        correlationId: corr 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid authentication',
        correlationId: corr 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Parse request
    const { orgId: requestOrgId, planKey: requestPlanKey }: PreflightRequest = await req.json()
    orgId = requestOrgId
    planKey = requestPlanKey

    console.log('[billing-preflight:input]', { corr, orgId, planKey })

    const checks: CheckResult[] = []

    // 1. Stripe API Key Check
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      checks.push({
        id: 'api_key',
        status: 'fail',
        code: 'API_KEY_MISSING',
        hint: 'Configure STRIPE_SECRET_KEY in environment variables'
      })
    } else {
      stripeMode = stripeKey.startsWith('sk_live_') ? 'live' : 'test'
      checks.push({
        id: 'api_key',
        status: 'pass',
        code: null,
        hint: null
      })
    }

    // 2. Organization ID Check
    if (!orgId || orgId.trim() === '') {
      checks.push({
        id: 'org',
        status: 'fail',
        code: 'ORG_ID_MISSING',
        hint: 'Select an organization before checkout'
      })
    } else {
      // Verify org exists and user has access
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('id', orgId)
        .single()

      if (!org) {
        checks.push({
          id: 'org',
          status: 'fail',
          code: 'ORG_NOT_FOUND',
          hint: 'Selected organization does not exist'
        })
      } else if (org.status === 'suspended') {
        checks.push({
          id: 'org',
          status: 'fail',
          code: 'ORG_SUSPENDED',
          hint: 'Contact support to reactivate your organization'
        })
      } else {
        // Check user access
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', userData.user.id)
          .single()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          checks.push({
            id: 'org',
            status: 'fail',
            code: 'ORG_ACCESS_DENIED',
            hint: 'You need admin access to manage billing'
          })
        } else {
          checks.push({
            id: 'org',
            status: 'pass',
            code: null,
            hint: null
          })
        }
      }
    }

    // 3. Plan Configuration Check
    if (!planKey) {
      checks.push({
        id: 'plan',
        status: 'fail',
        code: 'PLAN_NOT_SPECIFIED',
        hint: 'Specify a plan for checkout'
      })
    } else {
      const { data: planConfig, error: planError } = await supabase
        .from('plan_configs')
        .select('*')
        .eq('plan_key', planKey)
        .eq('is_active', true)
        .single()

      if (planError || !planConfig) {
        checks.push({
          id: 'plan',
          status: 'fail',
          code: 'PLAN_NOT_FOUND',
          hint: 'Check plan configuration in Admin → Stripe Configuration'
        })
      } else {
        checks.push({
          id: 'plan',
          status: 'pass',
          code: null,
          hint: null
        })

        // 4. Price ID Configuration Check
        priceId = planConfig.stripe_price_id_monthly
        const isDevelopment = Deno.env.get('NODE_ENV') !== 'production'

        if (!priceId && stripeMode === 'live' && !isDevelopment) {
          checks.push({
            id: 'price',
            status: 'fail',
            code: 'PRICE_NOT_CONFIGURED',
            hint: 'Set stripe_price_id_monthly for this plan in Admin → Stripe Configuration'
          })
        } else if (!priceId && stripeMode === 'test') {
          checks.push({
            id: 'price',
            status: 'pass',
            code: null,
            hint: null
          })
        } else if (priceId) {
          // 5. Stripe Price Validation
          if (stripeKey) {
            try {
              const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
              await stripe.prices.retrieve(priceId)
              
              checks.push({
                id: 'price',
                status: 'pass',
                code: null,
                hint: null
              })
            } catch (stripeError: any) {
              if (stripeError.code === 'resource_missing') {
                checks.push({
                  id: 'price',
                  status: 'fail',
                  code: 'NO_SUCH_PRICE',
                  hint: 'Key/price mode mismatch or typo.'
                })
              } else {
                checks.push({
                  id: 'price',
                  status: 'fail',
                  code: 'STRIPE_API_ERROR',
                  hint: `Stripe API error: ${stripeError.message}`
                })
              }
            }
          }
        } else {
          checks.push({
            id: 'price',
            status: 'pass',
            code: null,
            hint: null
          })
        }
      }
    }

    // 6. Webhook Secret Check (warning only)
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret || webhookSecret.trim() === '') {
      checks.push({
        id: 'webhook',
        status: 'warn',
        code: 'WEBHOOK_SECRET_MISSING',
        hint: `Add ${stripeMode === 'live' ? 'live' : 'test'} whsec_... to STRIPE_WEBHOOK_SECRET`
      })
    } else {
      checks.push({
        id: 'webhook',
        status: 'pass',
        code: null,
        hint: null
      })
    }

    const result = {
      corr,
      mode: stripeMode,
      orgId,
      planKey,
      priceId,
      checks: checks.map(check => ({
        id: check.id,
        status: check.status,
        ...(check.code && { code: check.code }),
        ...(check.hint && { hint: check.hint })
      }))
    }

    console.log('[billing-preflight:result]', { 
      corr, 
      mode: stripeMode,
      orgId,
      planKey,
      priceId,
      checkCount: checks.length
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.log('[billing-preflight:error]', { corr, error: error.message })
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Internal error',
      correlationId: corr,
      context: { stripeMode, orgId, planKey }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})