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
        id: 'stripe_key',
        name: 'Stripe API Key',
        status: 'fail',
        message: 'Stripe API key not configured',
        hint: 'Configure STRIPE_SECRET_KEY in environment variables'
      })
    } else {
      stripeMode = stripeKey.startsWith('sk_live_') ? 'live' : 'test'
      checks.push({
        id: 'stripe_key',
        name: 'Stripe API Key',
        status: 'pass',
        message: `Stripe ${stripeMode} mode configured`,
        details: { mode: stripeMode }
      })
    }

    // 2. Organization ID Check
    if (!orgId || orgId.trim() === '') {
      checks.push({
        id: 'org_id',
        name: 'Organization Selection',
        status: 'fail',
        message: 'No organization selected',
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
          id: 'org_id',
          name: 'Organization Selection',
          status: 'fail',
          message: 'Organization not found',
          hint: 'Selected organization does not exist'
        })
      } else if (org.status === 'suspended') {
        checks.push({
          id: 'org_id',
          name: 'Organization Selection',
          status: 'fail',
          message: 'Organization is suspended',
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
            id: 'org_id',
            name: 'Organization Selection',
            status: 'fail',
            message: 'Insufficient permissions',
            hint: 'You need admin access to manage billing'
          })
        } else {
          checks.push({
            id: 'org_id',
            name: 'Organization Selection',
            status: 'pass',
            message: `Organization "${org.name}" selected`,
            details: { orgName: org.name, userRole: membership.role }
          })
        }
      }
    }

    // 3. Plan Configuration Check
    if (!planKey) {
      checks.push({
        id: 'plan_config',
        name: 'Plan Configuration',
        status: 'fail',
        message: 'No plan specified',
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
          id: 'plan_config',
          name: 'Plan Configuration',
          status: 'fail',
          message: `Plan "${planKey}" not found or inactive`,
          hint: 'Check plan configuration in Admin → Stripe Configuration'
        })
      } else {
        checks.push({
          id: 'plan_config',
          name: 'Plan Configuration',
          status: 'pass',
          message: `Plan "${planConfig.display_name}" found`,
          details: { planKey, displayName: planConfig.display_name, productLine: planConfig.product_line }
        })

        // 4. Price ID Configuration Check
        const priceId = planConfig.stripe_price_id_monthly
        const isDevelopment = Deno.env.get('NODE_ENV') !== 'production'

        if (!priceId && stripeMode === 'live' && !isDevelopment) {
          checks.push({
            id: 'price_mapping',
            name: 'Price ID Mapping',
            status: 'fail',
            message: 'No price ID configured for live mode',
            hint: 'Set stripe_price_id_monthly for this plan in Admin → Stripe Configuration'
          })
        } else if (!priceId && stripeMode === 'test') {
          checks.push({
            id: 'price_mapping',
            name: 'Price ID Mapping',
            status: 'warning',
            message: 'No price ID configured (test mode will use dynamic pricing)',
            details: { mode: stripeMode, fallback: 'dynamic_test_price' }
          })
        } else if (priceId) {
          // 5. Stripe Price Validation
          if (stripeKey) {
            try {
              const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
              const price = await stripe.prices.retrieve(priceId)
              
              checks.push({
                id: 'price_mapping',
                name: 'Price ID Mapping',
                status: 'pass',
                message: `Price ID "${priceId}" configured and valid`,
                details: { priceId, amount: price.unit_amount, currency: price.currency }
              })

              checks.push({
                id: 'stripe_price_validation',
                name: 'Stripe Price Validation',
                status: 'pass',
                message: `Price exists in Stripe ${stripeMode} environment`,
                details: { priceId, validated: true }
              })
            } catch (stripeError: any) {
              if (stripeError.code === 'resource_missing') {
                checks.push({
                  id: 'stripe_price_validation',
                  name: 'Stripe Price Validation',
                  status: 'fail',
                  message: 'Price ID not found in Stripe',
                  hint: `Price ID "${priceId}" doesn't exist in Stripe ${stripeMode} environment. Check Admin → Stripe Configuration.`
                })
              } else {
                checks.push({
                  id: 'stripe_price_validation',
                  name: 'Stripe Price Validation',
                  status: 'fail',
                  message: `Stripe API error: ${stripeError.message}`,
                  hint: 'Check Stripe API key and price configuration'
                })
              }
            }
          }
        } else {
          checks.push({
            id: 'price_mapping',
            name: 'Price ID Mapping',
            status: 'pass',
            message: 'Development mode - dynamic pricing will be used',
            details: { mode: 'development', fallback: 'dynamic_test_price' }
          })
        }
      }
    }

    // Determine overall status
    const hasFailures = checks.some(check => check.status === 'fail')
    const hasWarnings = checks.some(check => check.status === 'warning')
    
    const overallStatus = hasFailures ? 'fail' : hasWarnings ? 'warning' : 'pass'
    const canProceed = !hasFailures

    const result = {
      success: true,
      correlationId: corr,
      overallStatus,
      canProceed,
      context: {
        stripeMode,
        orgId,
        planKey,
        timestamp: new Date().toISOString()
      },
      checks
    }

    console.log('[billing-preflight:result]', { 
      corr, 
      overallStatus, 
      canProceed, 
      checkCount: checks.length,
      failures: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warning').length
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