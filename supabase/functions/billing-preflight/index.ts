import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface PreflightRequest {
  orgId: string
  planKey: string
}

interface CheckResult {
  id: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  hint?: string
  details?: any
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  const corr = crypto.randomUUID()
  let stripeMode = 'unknown'
  let orgId: string | undefined
  let planKey: string | undefined
  let priceId: string | undefined

  try {
    console.log('[billing-preflight:start]', { corr })

    // Check service role key first
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({
        corr,
        code: "SERVICE_ROLE_MISSING",
        message: "Service role key not configured",
        hint: "Configure SUPABASE_SERVICE_ROLE_KEY environment variable"
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({
        corr,
        code: "UNAUTHORIZED",
        message: "Authentication required",
        hint: "Provide valid Bearer token in Authorization header"
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({
        corr,
        code: "UNAUTHORIZED",
        message: "Invalid authentication token",
        hint: "Sign in again or refresh your session"
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request
    let requestBody: PreflightRequest
    try {
      requestBody = await req.json()
      orgId = requestBody.orgId
      planKey = requestBody.planKey
    } catch (error) {
      return new Response(JSON.stringify({
        corr,
        code: "INVALID_REQUEST",
        message: "Invalid JSON in request body",
        hint: "Ensure request body is valid JSON with orgId and planKey"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[billing-preflight:input]', { corr, orgId, planKey })

    const checks: CheckResult[] = []

    // 1. Stripe API Key Check
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({
        corr,
        code: "API_KEY_MISSING", 
        message: "Stripe API key not configured",
        hint: "Configure STRIPE_SECRET_KEY environment variable"
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    stripeMode = stripeKey.startsWith('sk_live_') ? 'live' : 'test'
    checks.push({
      id: 'api_key',
      status: 'pass',
      message: `Stripe API key configured (${stripeMode} mode)`,
      details: { mode: stripeMode }
    })

    // 2. Organization ID Check
    if (!orgId || orgId.trim() === '') {
      return new Response(JSON.stringify({
        corr,
        code: "ORG_ID_MISSING",
        message: "Organization ID is required",
        hint: "Select an organization before checkout"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify org exists and user has access
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, status')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      checks.push({
        id: 'organization',
        status: 'fail',
        message: 'Organization not found',
        hint: 'Selected organization does not exist or you lack access',
        details: { orgId }
      })
    } else if (org.status === 'suspended') {
      checks.push({
        id: 'organization',
        status: 'fail',
        message: 'Organization is suspended',
        hint: 'Contact support to reactivate your organization',
        details: { orgId, status: org.status }
      })
    } else {
      // Check user access (admin or owner)
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userData.user.id)
        .single()

      const isOwner = org.owner_user_id === userData.user.id
      const isAdmin = membership?.role === 'admin'

      if (!isOwner && !isAdmin) {
        return new Response(JSON.stringify({
          corr,
          code: "FORBIDDEN",
          message: "Insufficient permissions for billing operations",
          hint: "You need admin access to manage billing"
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      checks.push({
        id: 'organization',
        status: 'pass',
        message: `Organization validated: ${org.name}`,
        details: { orgId: org.id, name: org.name, status: org.status }
      })
    }

    // 3. Plan Configuration Check
    if (!planKey) {
      return new Response(JSON.stringify({
        corr,
        code: "PLAN_KEY_MISSING",
        message: "Plan key is required",
        hint: "Specify a plan for checkout"
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: planConfig, error: planError } = await supabase
      .from('plan_configs')
      .select('*')
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .single()

    if (planError || !planConfig) {
      checks.push({
        id: 'plan_config',
        status: 'fail',
        message: 'Plan configuration not found',
        hint: 'Check plan configuration in Admin → Stripe Configuration',
        details: { planKey, error: planError?.message }
      })
    } else {
      checks.push({
        id: 'plan_config',
        status: 'pass',
        message: `Plan configured: ${planConfig.display_name}`,
        details: { planKey, displayName: planConfig.display_name }
      })

      // 4. Price ID Configuration Check
      priceId = planConfig.stripe_price_id_monthly

      if (!priceId && stripeMode === 'live') {
        return new Response(JSON.stringify({
          corr,
          code: "PRICE_NOT_CONFIGURED",
          message: "Price ID not configured for live mode",
          hint: "Set stripe_price_id_monthly for this plan in Admin → Stripe Configuration"
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (!priceId && stripeMode === 'test') {
        checks.push({
          id: 'price_config',
          status: 'warning',
          message: 'Price ID not set (test mode)',
          hint: 'Configure stripe_price_id_monthly for production'
        })
      } else if (priceId) {
        // 5. Stripe Price Validation
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
          const price = await stripe.prices.retrieve(priceId)
          
          checks.push({
            id: 'stripe_price',
            status: 'pass',
            message: 'Price validated in Stripe',
            details: { 
              priceId, 
              currency: price.currency, 
              amount: price.unit_amount,
              active: price.active 
            }
          })
        } catch (stripeError: any) {
          if (stripeError.code === 'resource_missing') {
            return new Response(JSON.stringify({
              corr,
              code: "NO_SUCH_PRICE",
              message: "Price not found in Stripe",
              hint: `Price ID '${priceId}' doesn't exist in ${stripeMode} mode`,
              details: { priceId, mode: stripeMode }
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          } else if (stripeError.type === 'StripePermissionError') {
            return new Response(JSON.stringify({
              corr,
              code: "INSUFFICIENT_STRIPE_PERMISSIONS",
              message: "Stripe API key lacks required permissions",
              hint: "Check Stripe API key permissions",
              details: { error: stripeError.message }
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          } else {
            checks.push({
              id: 'stripe_price',
              status: 'fail',
              message: 'Failed to validate price in Stripe',
              hint: `Stripe API error: ${stripeError.message}`,
              details: { priceId, error: stripeError.message }
            })
          }
        }
      } else {
        checks.push({
          id: 'price_config',
          status: 'pass',
          message: 'Price configuration validated'
        })
      }
    }

    // 6. Webhook Secret Check (warning only)
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret || webhookSecret.trim() === '') {
      checks.push({
        id: 'webhook_secret',
        status: 'warning',
        message: 'Webhook secret not configured',
        hint: `Add ${stripeMode === 'live' ? 'live' : 'test'} whsec_... to STRIPE_WEBHOOK_SECRET`
      })
    } else {
      checks.push({
        id: 'webhook_secret',
        status: 'pass',
        message: 'Webhook secret configured'
      })
    }

    // Determine overall status
    const hasFailures = checks.some(check => check.status === 'fail')
    const hasWarnings = checks.some(check => check.status === 'warning')
    const overallStatus = hasFailures ? 'fail' : hasWarnings ? 'warning' : 'pass'
    const canProceed = !hasFailures

    const result = {
      corr,
      mode: stripeMode,
      orgId,
      planKey,
      priceId,
      overallStatus,
      canProceed,
      checks
    }

    console.log('[billing-preflight:result]', { 
      corr, 
      mode: stripeMode,
      orgId,
      planKey,
      priceId,
      overallStatus,
      canProceed,
      checkCount: checks.length
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.log('[billing-preflight:error]', { corr, error: error.message })
    return new Response(JSON.stringify({
      corr,
      code: "INTERNAL_ERROR",
      message: "Internal server error during preflight check",
      hint: "Check server logs for details",
      details: { error: error.message, context: { stripeMode, orgId, planKey } }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})