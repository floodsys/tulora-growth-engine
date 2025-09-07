import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`[admin-stripe-config] ${req.method} request received`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;

    // Check if user is superadmin
    const { data: isSuperadmin } = await supabaseClient.rpc('is_superadmin', { user_id: userData.user.id });
    if (!isSuperadmin) {
      throw new Error("Access denied - superadmin required");
    }

    if (req.method === 'GET') {
      console.log('[admin-stripe-config] Processing GET request');
      
      // GUARDRAIL: Enforce product line filtering - only leadgen and support
      const allowedPlans = [
        'leadgen_starter', 'leadgen_business', 'leadgen_enterprise',
        'support_starter', 'support_business', 'support_enterprise'
      ];
      
      const { data: plans, error: plansError } = await supabaseClient
        .from('plan_configs')
        .select('plan_key, display_name, stripe_price_id_monthly, stripe_setup_price_id, product_line')
        .eq('is_active', true)
        .in('product_line', ['leadgen', 'support']) // GUARDRAIL: Enforce allowed product lines
        .in('plan_key', allowedPlans)
        .order('product_line, plan_key');

      // HEALTH CHECK: Detect any active Core plans that shouldn't exist
      const { data: corePlans, error: corePlansError } = await supabaseClient
        .from('plan_configs')
        .select('plan_key, display_name')
        .eq('is_active', true)
        .eq('product_line', 'core');

      if (corePlansError) {
        console.error('[admin-stripe-config] Core plans check error:', corePlansError);
      }

      if (plansError) {
        console.error('[admin-stripe-config] Plans error:', plansError);
        throw plansError;
      }
      
      console.log('[admin-stripe-config] Retrieved plans:', plans?.length);

      // Check portal and webhook status
      let portalEnabled = false;
      let webhookReachable = false;

      try {
        // Try to create a test portal session to check if configured
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        console.log('[admin-stripe-config] Stripe key present:', !!stripeKey);
        
        if (stripeKey) {
          console.log('[admin-stripe-config] Testing Stripe portal configuration...');
          const testResponse = await fetch("https://api.stripe.com/v1/billing_portal/configurations", {
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          portalEnabled = testResponse.ok;
          console.log('[admin-stripe-config] Portal test response:', testResponse.status, testResponse.ok);
        } else {
          console.log('[admin-stripe-config] No Stripe key found');
        }
      } catch (e) {
        console.log("[admin-stripe-config] Portal check failed:", e.message);
      }

      try {
        // Check if webhook is properly configured and has required events
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        
        if (supabaseUrl && webhookSecret && stripeKey) {
          const webhookUrl = `${supabaseUrl}/functions/v1/org-billing-webhook`;
          console.log('[admin-stripe-config] Testing webhook URL:', webhookUrl);
          
          // Test if webhook endpoint is reachable
          const response = await fetch(webhookUrl, { 
            method: 'HEAD',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          // Webhook is considered reachable if it responds (even with 400/401 is fine since we're not sending proper data)
          webhookReachable = response.status < 500;
          console.log('[admin-stripe-config] Webhook test response:', response.status, webhookReachable);
          
          // Also check if webhook events are properly configured
          try {
            const webhookEndpointsResponse = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
              headers: {
                "Authorization": `Bearer ${stripeKey}`,
                "Content-Type": "application/x-www-form-urlencoded"
              }
            });
            
            if (webhookEndpointsResponse.ok) {
              const webhookData = await webhookEndpointsResponse.json();
              const requiredEvents = [
                'checkout.session.completed',
                'customer.subscription.created',
                'customer.subscription.updated',
                'customer.subscription.deleted',
                'invoice.payment_succeeded',
                'invoice.payment_failed'
              ];
              
              const hasRequiredWebhook = webhookData.data.some((endpoint: any) => 
                endpoint.url === webhookUrl && 
                requiredEvents.every((event: string) => endpoint.enabled_events.includes(event))
              );
              
              if (!hasRequiredWebhook) {
                webhookReachable = false;
                console.log('[admin-stripe-config] Webhook missing required events');
              }
            }
          } catch (e) {
            console.log("[admin-stripe-config] Webhook events check failed:", e.message);
          }
        } else {
          console.log('[admin-stripe-config] Missing webhook configuration - URL, secret, or Stripe key not set');
        }
      } catch (e) {
        console.log("[admin-stripe-config] Webhook check failed:", e.message);
      }

      // Check readiness for Live mode - only count non-enterprise paid plans
      const paidPlans = plans?.filter(p => 
        (p.plan_key.includes('_starter') || p.plan_key.includes('_business')) &&
        !p.plan_key.includes('enterprise')
      ) || [];
      const allPaidPlansConfigured = paidPlans.every(plan => 
        plan.stripe_price_id_monthly && plan.stripe_setup_price_id
      );
      
      const isLiveReady = portalEnabled && webhookReachable && allPaidPlansConfigured;

      return new Response(JSON.stringify({
        plans,
        status: {
          portalEnabled,
          webhookReachable,
          allPaidPlansConfigured,
          isLiveReady
        },
        healthCheck: {
          coreWarning: corePlans && corePlans.length > 0 ? {
            message: `WARNING: ${corePlans.length} Core plan(s) are active and should be disabled`,
            corePlans: corePlans.map(p => ({ plan_key: p.plan_key, display_name: p.display_name }))
          } : null
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      
      if (body.action === 'validate_price') {
        // Validate price ID via Stripe API
        const { priceId } = body;
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        
        if (!stripeKey) {
          throw new Error("Stripe secret key not configured");
        }
        
        try {
          const response = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          
          if (!response.ok) {
            throw new Error("Invalid price ID or not found");
          }
          
          const priceData = await response.json();
          const productResponse = await fetch(`https://api.stripe.com/v1/products/${priceData.product}`, {
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          
          const productData = await productResponse.json();
          
          // Check if this is test mode
          const isTestMode = priceId.startsWith('price_test_') || !stripeKey.startsWith('sk_live_');
          
          return new Response(JSON.stringify({
            success: true,
            validation: {
              productName: productData.name,
              amount: priceData.unit_amount,
              currency: priceData.currency,
              recurring: !!priceData.recurring,
              interval: priceData.recurring?.interval,
              isTestMode,
              livemode: priceData.livemode
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } else {
        // Save plan configuration
        const { plan_key, stripe_price_id_monthly, stripe_setup_price_id } = body;

        // GUARDRAIL: Verify this is an allowed plan before saving
        const allowedPlans = [
          'leadgen_starter', 'leadgen_business', 'leadgen_enterprise',
          'support_starter', 'support_business', 'support_enterprise'
        ];
        
        if (!allowedPlans.includes(plan_key)) {
          throw new Error(`Plan ${plan_key} is not allowed - only leadgen and support plans are permitted`);
        }

        const { error } = await supabaseClient
          .from('plan_configs')
          .upsert({
            plan_key,
            stripe_price_id_monthly,
            stripe_setup_price_id,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'plan_key'
          });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    throw new Error("Method not allowed");

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});