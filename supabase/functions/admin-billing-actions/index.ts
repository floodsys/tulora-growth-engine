import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActionRequest {
  action: 'create_portal_session' | 'change_plan' | 'suspend_service' | 'reinstate_service' | 'issue_credit' | 'create_coupon';
  customer_id?: string;
  subscription_id?: string;
  org_id?: string;
  new_plan?: string;
  amount?: number;
  description?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-BILLING-ACTIONS] ${step}${detailsStr}`);
};

const logAuditEvent = async (supabase: any, orgId: string, userId: string, action: string, details: any) => {
  try {
    await supabase.rpc('log_event', {
      p_org_id: orgId,
      p_action: action,
      p_target_type: 'billing',
      p_actor_user_id: userId,
      p_actor_role_snapshot: 'admin',
      p_metadata: details
    });
  } catch (error) {
    logStep("Failed to log audit event", { error: error.message });
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Use ANON client with user's auth header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Check if user is superadmin - this will use the user's auth context
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin');
    if (superadminError || !isSuperadmin) {
      logStep("Superadmin check failed", { error: superadminError, isSuperadmin });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Get user info for logging
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("Superadmin access verified", { userId: user.id, email: user.email });

    const body: ActionRequest = await req.json();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    switch (body.action) {
      case 'create_portal_session': {
        if (!body.customer_id) throw new Error("customer_id is required");
        
        logStep("Creating customer portal session", { customerId: body.customer_id });
        
        const session = await stripe.billingPortal.sessions.create({
          customer: body.customer_id,
          return_url: `${req.headers.get("origin")}/admin`,
        });

        if (body.org_id) {
          await logAuditEvent(supabaseClient, body.org_id, user.id, 'billing.portal_opened', {
            customer_id: body.customer_id,
            admin_user: user.email
          });
        }

        return new Response(JSON.stringify({ url: session.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'change_plan': {
        if (!body.subscription_id || !body.new_plan || !body.org_id) {
          throw new Error("subscription_id, new_plan, and org_id are required");
        }
        
        logStep("Changing plan", { subscriptionId: body.subscription_id, newPlan: body.new_plan });
        
        // Get plan config from Supabase
        const { data: planConfig, error: planError } = await supabaseClient
          .from('plan_configs')
          .select('*')
          .eq('plan_key', body.new_plan)
          .eq('is_active', true)
          .single();

        if (planError || !planConfig) throw new Error(`Plan ${body.new_plan} not found`);

        // Get current subscription
        const subscription = await stripe.subscriptions.retrieve(body.subscription_id);
        
        // Update subscription with new price
        const updatedSubscription = await stripe.subscriptions.update(body.subscription_id, {
          items: [{
            id: subscription.items.data[0].id,
            price: planConfig.stripe_price_id_monthly, // Default to monthly
          }],
          proration_behavior: 'always_invoice',
        });

        // Update in Supabase
        await supabaseClient
          .from('org_stripe_subscriptions')
          .update({ plan_key: body.new_plan })
          .eq('stripe_subscription_id', body.subscription_id);

        await logAuditEvent(supabaseClient, body.org_id, user.id, 'billing.plan_changed', {
          subscription_id: body.subscription_id,
          new_plan: body.new_plan,
          admin_user: user.email
        });

        return new Response(JSON.stringify({ 
          success: true, 
          subscription: updatedSubscription 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'suspend_service':
      case 'reinstate_service': {
        if (!body.org_id) throw new Error("org_id is required");
        
        const isSuspending = body.action === 'suspend_service';
        logStep(isSuspending ? "Suspending service" : "Reinstating service", { orgId: body.org_id });
        
        // Update organization status
        await supabaseClient
          .from('organizations')
          .update({ 
            billing_status: isSuspending ? 'suspended' : 'active'
          })
          .eq('id', body.org_id);

        // If suspending and has subscription, pause it
        if (isSuspending && body.subscription_id) {
          await stripe.subscriptions.update(body.subscription_id, {
            pause_collection: { behavior: 'void' }
          });
        }

        // If reinstating and has subscription, resume it
        if (!isSuspending && body.subscription_id) {
          await stripe.subscriptions.update(body.subscription_id, {
            pause_collection: ''
          });
        }

        await logAuditEvent(supabaseClient, body.org_id, user.id, 
          isSuspending ? 'billing.service_suspended' : 'billing.service_reinstated', {
          org_id: body.org_id,
          admin_user: user.email
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'issue_credit': {
        if (!body.customer_id || !body.amount || !body.description || !body.org_id) {
          throw new Error("customer_id, amount, description, and org_id are required");
        }
        
        logStep("Issuing credit", { customerId: body.customer_id, amount: body.amount });
        
        const credit = await stripe.customers.createBalanceTransaction(body.customer_id, {
          amount: -Math.abs(body.amount), // Negative for credit
          currency: 'usd',
          description: body.description,
        });

        await logAuditEvent(supabaseClient, body.org_id, user.id, 'billing.credit_issued', {
          customer_id: body.customer_id,
          amount: body.amount,
          description: body.description,
          admin_user: user.email
        });

        return new Response(JSON.stringify({ success: true, credit }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'create_coupon': {
        if (!body.amount || !body.description || !body.org_id) {
          throw new Error("amount, description, and org_id are required");
        }
        
        logStep("Creating coupon", { amount: body.amount });
        
        const coupon = await stripe.coupons.create({
          percent_off: body.amount,
          duration: 'once',
          name: body.description,
        });

        await logAuditEvent(supabaseClient, body.org_id, user.id, 'billing.coupon_created', {
          coupon_id: coupon.id,
          percent_off: body.amount,
          description: body.description,
          admin_user: user.email
        });

        return new Response(JSON.stringify({ success: true, coupon }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Return structured error response
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});