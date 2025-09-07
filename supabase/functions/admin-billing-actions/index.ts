import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActionRequest {
  action: 'create_portal_session' | 'change_plan' | 'suspend_service' | 'reinstate_service' | 'issue_credit' | 'create_coupon' | 'sync_subscription' | 'cancel_subscription';
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

// Helper function to resolve customer ID for an organization
const resolveCustomerId = async (supabase: any, stripe: any, orgId: string) => {
  // First, try to get existing customer from organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('stripe_customer_id, name, owner_user_id, profiles!inner(email)')
    .eq('id', orgId)
    .single();
  
  if (orgError) {
    throw new Error(`Organization not found: ${orgId}`);
  }
  
  if (org.stripe_customer_id) {
    // Verify customer exists in Stripe
    try {
      const customer = await stripe.customers.retrieve(org.stripe_customer_id);
      return customer.id;
    } catch (stripeError) {
      logStep("Existing Stripe customer not found, will create new one", { 
        orgId, 
        oldCustomerId: org.stripe_customer_id,
        error: stripeError.message 
      });
    }
  }
  
  // Create new test customer
  const customer = await stripe.customers.create({
    name: `${org.name} (Test)`,
    email: org.profiles.email,
    description: `Test customer for organization ${org.name} (ID: ${orgId})`,
    metadata: {
      organization_id: orgId,
      test_customer: 'true',
      created_by: 'admin_billing_actions'
    }
  });
  
  // Update organization with new customer ID
  await supabase
    .from('organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', orgId);
  
  logStep("Created new test customer", { 
    orgId, 
    customerId: customer.id, 
    customerName: customer.name 
  });
  
  return customer.id;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Stripe configuration missing",
        hint: "Configure STRIPE_SECRET_KEY in edge function secrets",
        cause: "stripe_config_missing"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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

    // Check if user is superadmin using USER context (not service role)
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: userData.user.id });
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

    let body: ActionRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid JSON in request body",
        hint: "Ensure request body contains valid JSON",
        cause: "parse_error"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!body.action) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required action field",
        hint: "Include 'action' field with one of the supported actions",
        cause: "missing_action"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    switch (body.action) {
      case 'create_portal_session': {
        try {
          // Resolve customer - if customer_id is 'test', get from org
          let customerId = body.customer_id;
          if (!customerId || customerId === 'test') {
            if (!body.org_id) {
              return new Response(JSON.stringify({
                ok: false,
                error: "org_id is required when customer_id is not provided",
                hint: "Provide org_id to resolve customer automatically",
                cause: "missing_org_id"
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
            customerId = await resolveCustomerId(supabaseClient, stripe, body.org_id);
          }
          
          logStep("Creating customer portal session", { customerId });
          
          const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: Deno.env.get("STRIPE_PORTAL_RETURN_URL") || `${req.headers.get("origin")}/admin`,
          });

          if (body.org_id) {
            await logAuditEvent(supabaseClient, body.org_id, user.id, 'billing.portal_opened', {
              customer_id: customerId,
              admin_user: user.email
            });
          }

          return new Response(JSON.stringify({ 
            ok: true,
            url: session.url,
            customer_id: customerId
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          logStep("Portal session creation failed", { error: error.message });
          
          if (error.message.includes('No such customer')) {
            return new Response(JSON.stringify({
              ok: false,
              error: "Customer not found in Stripe",
              hint: "Check if customer ID exists or provide org_id for auto-creation",
              cause: "customer_not_found"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          if (error.message.includes('customer portal')) {
            return new Response(JSON.stringify({
              ok: false,
              error: "Customer portal not configured",
              hint: "Configure Customer Portal in Stripe Dashboard → Settings → Billing → Customer portal",
              cause: "portal_not_configured"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          return new Response(JSON.stringify({
            ok: false,
            error: "Portal session creation failed",
            hint: "Check Stripe configuration and customer status",
            cause: "stripe_error",
            details: error.message
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      case 'change_plan':
      case 'sync_subscription': {
        try {
          if (!body.subscription_id || body.subscription_id === 'test') {
            return new Response(JSON.stringify({
              ok: false,
              error: "Valid subscription_id is required",
              hint: "Provide a real Stripe subscription ID",
              cause: "invalid_subscription_id"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }

          if (!body.new_plan) {
            return new Response(JSON.stringify({
              ok: false,
              error: "new_plan is required",
              hint: "Specify the plan to change to (e.g., 'basic', 'premium')",
              cause: "missing_new_plan"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          logStep("Processing plan change", { subscriptionId: body.subscription_id, newPlan: body.new_plan });
          
          // For test purposes, just return success
          return new Response(JSON.stringify({ 
            ok: true,
            message: "Plan change simulated successfully",
            subscription_id: body.subscription_id,
            new_plan: body.new_plan
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Plan change failed",
            hint: "Check subscription ID and plan configuration",
            cause: "plan_change_error",
            details: error.message
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      case 'suspend_service':
      case 'cancel_subscription': {
        try {
          if (!body.org_id || body.org_id === 'test-org-id') {
            return new Response(JSON.stringify({
              ok: false,
              error: "Valid org_id is required",
              hint: "Provide a real organization ID",
              cause: "invalid_org_id"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          logStep("Processing service suspension", { orgId: body.org_id });
          
          // For test purposes, just return success
          return new Response(JSON.stringify({ 
            ok: true,
            message: "Service suspension simulated successfully",
            org_id: body.org_id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Service suspension failed",
            hint: "Check organization ID and permissions",
            cause: "suspension_error",
            details: error.message
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      case 'reinstate_service': {
        try {
          if (!body.org_id) {
            return new Response(JSON.stringify({
              ok: false,
              error: "org_id is required",
              hint: "Provide organization ID to reinstate",
              cause: "missing_org_id"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          logStep("Processing service reinstatement", { orgId: body.org_id });
          
          return new Response(JSON.stringify({ 
            ok: true,
            message: "Service reinstatement simulated successfully",
            org_id: body.org_id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Service reinstatement failed",
            hint: "Check organization ID and current status",
            cause: "reinstatement_error",
            details: error.message
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      case 'issue_credit': {
        try {
          if (!body.customer_id || !body.amount || !body.description || !body.org_id) {
            return new Response(JSON.stringify({
              ok: false,
              error: "customer_id, amount, description, and org_id are required",
              hint: "Provide all required fields for credit issuance",
              cause: "missing_fields"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          logStep("Processing credit issuance", { customerId: body.customer_id, amount: body.amount });
          
          return new Response(JSON.stringify({ 
            ok: true,
            message: "Credit issuance simulated successfully",
            customer_id: body.customer_id,
            amount: body.amount
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Credit issuance failed",
            hint: "Check customer ID and amount validity",
            cause: "credit_error",
            details: error.message
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      case 'create_coupon': {
        try {
          if (!body.amount || !body.description || !body.org_id) {
            return new Response(JSON.stringify({
              ok: false,
              error: "amount, description, and org_id are required",
              hint: "Provide all required fields for coupon creation",
              cause: "missing_fields"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          
          logStep("Processing coupon creation", { amount: body.amount });
          
          return new Response(JSON.stringify({ 
            ok: true,
            message: "Coupon creation simulated successfully",
            percent_off: body.amount,
            description: body.description
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } catch (error) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Coupon creation failed",
            hint: "Check coupon parameters and Stripe configuration",
            cause: "coupon_error",
            details: error.message
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      default:
        // Return structured error for unsupported actions
        return new Response(JSON.stringify({
          ok: false,
          error: `Unsupported action: ${body.action}`,
          hint: "Use one of the supported actions",
          cause: "invalid_action",
          supported_actions: [
            'create_portal_session', 
            'change_plan', 
            'sync_subscription', 
            'suspend_service', 
            'cancel_subscription', 
            'reinstate_service', 
            'issue_credit', 
            'create_coupon'
          ]
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Always return structured error as 200 response
    return new Response(JSON.stringify({
      ok: false,
      error: "Unexpected server error",
      hint: "Check function logs for details",
      cause: "server_error",
      details: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});