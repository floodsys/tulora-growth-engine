import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
      // Get plan configs and check status
      const { data: plans, error: plansError } = await supabaseClient
        .from('plan_configs')
        .select('plan_key, display_name, stripe_price_id_monthly, stripe_setup_price_id')
        .eq('is_active', true)
        .order('plan_key');

      if (plansError) throw plansError;

      // Check portal and webhook status
      let portalEnabled = false;
      let webhookReachable = false;

      try {
        // Try to create a test portal session to check if configured
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey) {
          const testResponse = await fetch("https://api.stripe.com/v1/billing_portal/configurations", {
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          portalEnabled = testResponse.ok;
        }
      } catch (e) {
        console.log("Portal check failed:", e.message);
      }

      try {
        // Simple webhook health check
        const webhookUrl = Deno.env.get("WEBHOOK_URL");
        if (webhookUrl) {
          const response = await fetch(webhookUrl, { method: 'HEAD' });
          webhookReachable = response.status < 500;
        }
      } catch (e) {
        console.log("Webhook check failed:", e.message);
      }

      return new Response(JSON.stringify({
        plans,
        status: {
          portalEnabled,
          webhookReachable
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (req.method === 'POST') {
      const { plan_key, stripe_price_id_monthly, stripe_setup_price_id } = await req.json();

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

    throw new Error("Method not allowed");

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});