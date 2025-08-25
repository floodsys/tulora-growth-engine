import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-SMOKE-TEST] ${step}${detailsStr}`);
};

interface StripeTestResult {
  test_name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client for authentication check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("Authentication failed", { error: userError.message });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: user.id });
    if (superadminError || !isSuperadmin) {
      logStep("Superadmin check failed", { error: superadminError?.message, isSuperadmin });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("User authenticated and authorized", { userId: user.id, email: user.email });

    const results: StripeTestResult[] = [];
    const timestamp = new Date().toISOString();

    // Check for Stripe secret key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      results.push({
        test_name: "Stripe Secret Key",
        status: "fail",
        message: "STRIPE_SECRET_KEY environment variable not found",
      });

      return new Response(JSON.stringify({
        success: false,
        timestamp,
        results,
        summary: {
          total_tests: results.length,
          passed: 0,
          failed: 1,
          warnings: 0
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    logStep("Stripe client initialized");

    // Test 1: Basic Stripe connectivity
    try {
      const account = await stripe.accounts.retrieve();
      results.push({
        test_name: "Stripe Account Access",
        status: "pass",
        message: "Successfully connected to Stripe account",
        details: {
          account_id: account.id,
          country: account.country,
          business_type: account.business_type,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted
        }
      });

      // Test 2: Verify account mode (test vs live)
      const isTestMode = stripeKey.startsWith('sk_test_');
      const accountMode = isTestMode ? 'test' : 'live';
      results.push({
        test_name: "Account Mode Verification",
        status: "pass",
        message: `Stripe account is in ${accountMode} mode`,
        details: {
          mode: accountMode,
          key_prefix: stripeKey.substring(0, 8) + '...'
        }
      });

    } catch (error) {
      results.push({
        test_name: "Stripe Account Access",
        status: "fail",
        message: `Failed to access Stripe account: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 3: List products (basic API test)
    try {
      const products = await stripe.products.list({ limit: 1 });
      results.push({
        test_name: "Products API",
        status: "pass",
        message: "Successfully accessed Products API",
        details: { products_count: products.data.length }
      });
    } catch (error) {
      results.push({
        test_name: "Products API",
        status: "fail",
        message: `Failed to access Products API: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 4: List prices (subscription pricing)
    try {
      const prices = await stripe.prices.list({ limit: 5 });
      results.push({
        test_name: "Prices API",
        status: "pass",
        message: `Found ${prices.data.length} price(s)`,
        details: { 
          prices_count: prices.data.length,
          price_ids: prices.data.map(p => ({ id: p.id, amount: p.unit_amount, currency: p.currency, recurring: !!p.recurring }))
        }
      });
    } catch (error) {
      results.push({
        test_name: "Prices API",
        status: "fail",
        message: `Failed to access Prices API: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 5: Check webhook endpoints
    try {
      const webhooks = await stripe.webhookEndpoints.list({ limit: 5 });
      results.push({
        test_name: "Webhook Endpoints",
        status: webhooks.data.length > 0 ? "pass" : "warning",
        message: webhooks.data.length > 0 
          ? `Found ${webhooks.data.length} webhook endpoint(s)` 
          : "No webhook endpoints configured",
        details: { 
          webhooks_count: webhooks.data.length,
          endpoints: webhooks.data.map(w => ({ id: w.id, url: w.url, status: w.status, enabled_events: w.enabled_events.length }))
        }
      });
    } catch (error) {
      results.push({
        test_name: "Webhook Endpoints",
        status: "fail",
        message: `Failed to access Webhook Endpoints: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 6: Test billing portal configuration
    try {
      const portalConfig = await stripe.billingPortal.configurations.list({ limit: 1 });
      results.push({
        test_name: "Billing Portal Configuration",
        status: portalConfig.data.length > 0 ? "pass" : "warning",
        message: portalConfig.data.length > 0 
          ? "Billing portal is configured" 
          : "No billing portal configuration found",
        details: { 
          configurations_count: portalConfig.data.length,
          configs: portalConfig.data.map(c => ({ id: c.id, is_default: c.is_default, business_profile: c.business_profile }))
        }
      });
    } catch (error) {
      results.push({
        test_name: "Billing Portal Configuration",
        status: "warning",
        message: `Could not access billing portal configuration: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 7: Validate billing endpoints capabilities
    try {
      // Test creating a test customer for billing operations
      const testCustomer = await stripe.customers.create({
        email: 'test-smoke-test@example.com',
        metadata: { test: 'smoke_test', created_at: new Date().toISOString() }
      });

      results.push({
        test_name: "Customer Creation (Billing Foundation)",
        status: "pass",
        message: "Successfully created test customer for billing operations",
        details: { customer_id: testCustomer.id }
      });

      // Test billing portal session creation (Portal endpoint validation)
      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: testCustomer.id,
          return_url: 'https://example.com/return'
        });
        results.push({
          test_name: "Billing Portal Session Creation",
          status: "pass",
          message: "Portal endpoint ready - can create billing portal sessions",
          details: { session_id: portalSession.id, url: portalSession.url.substring(0, 50) + '...' }
        });
      } catch (error) {
        results.push({
          test_name: "Billing Portal Session Creation",
          status: "fail",
          message: `Portal endpoint failing: ${error.message}`,
          details: { error: error.message }
        });
      }

      // Test subscription operations (Subscriptions/Sync/Cancel endpoint validation)
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: testCustomer.id,
          limit: 1
        });
        results.push({
          test_name: "Subscription Operations",
          status: "pass",
          message: "Subscription endpoints ready - can list/manage subscriptions",
          details: { subscriptions_accessible: true, customer_has_subscriptions: subscriptions.data.length > 0 }
        });
      } catch (error) {
        results.push({
          test_name: "Subscription Operations", 
          status: "fail",
          message: `Subscription endpoints failing: ${error.message}`,
          details: { error: error.message }
        });
      }

      // Clean up test customer
      try {
        await stripe.customers.del(testCustomer.id);
      } catch (error) {
        console.log('Warning: Could not clean up test customer:', error.message);
      }

    } catch (error) {
      results.push({
        test_name: "Billing Endpoints Validation",
        status: "fail",
        message: `Cannot validate billing endpoints: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 8: Validate invoice operations
    try {
      const invoices = await stripe.invoices.list({ limit: 1 });
      results.push({
        test_name: "Invoice Operations",
        status: "pass",
        message: "Invoice endpoints ready - can list invoices",
        details: { invoices_count: invoices.data.length }
      });
    } catch (error) {
      results.push({
        test_name: "Invoice Operations",
        status: "fail",
        message: `Invoice endpoints failing: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 9: Validate webhook events access
    try {
      const events = await stripe.events.list({ limit: 1 });
      results.push({
        test_name: "Webhook Events Access",
        status: "pass",
        message: "Webhook endpoints ready - can access events",
        details: { events_accessible: true, recent_events: events.data.length }
      });
    } catch (error) {
      results.push({
        test_name: "Webhook Events Access",
        status: "fail",
        message: `Webhook endpoints failing: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 10: Check for common environment variables
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripePortalReturnUrl = Deno.env.get("STRIPE_PORTAL_RETURN_URL");
    
    results.push({
      test_name: "Environment Variables",
      status: stripeWebhookSecret ? "pass" : "warning",
      message: `Webhook secret: ${stripeWebhookSecret ? 'configured' : 'not configured'}, Portal return URL: ${stripePortalReturnUrl ? 'configured' : 'not configured'}`,
      details: {
        webhook_secret_present: !!stripeWebhookSecret,
        portal_return_url_present: !!stripePortalReturnUrl
      }
    });

    // Calculate summary
    const summary = {
      total_tests: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      warnings: results.filter(r => r.status === 'warning').length
    };

    logStep("Smoke tests completed", summary);

    return new Response(JSON.stringify({
      success: true,
      timestamp,
      results,
      summary
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-smoke-test", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});