import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuspensionRequest {
  action: 'suspend' | 'reinstate' | 'cancel';
  org_id: string;
  reason: string;
  confirmation_phrase: string;
  notify_owner?: boolean;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-SUSPENSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    let body: SuspensionRequest;
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
        status: 400,
      });
    }

    const { action, org_id, reason, confirmation_phrase, notify_owner } = body;

    if (!org_id || !reason || !confirmation_phrase) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required fields",
        hint: "Include org_id, reason, and confirmation_phrase in request",
        cause: "missing_fields"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!action || !['suspend', 'reinstate', 'cancel'].includes(action)) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid action",
        hint: "Use one of: suspend, reinstate, cancel",
        cause: "invalid_action"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate confirmation phrase
    const expectedPhrase = action === 'suspend' ? 
      `SUSPEND ORG ${org_id}` : 
      action === 'cancel' ?
      `CANCEL ORG ${org_id}` :
      `REINSTATE ORG ${org_id}`;
    
    if (confirmation_phrase !== expectedPhrase) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid confirmation phrase",
        hint: `Expected: "${expectedPhrase}"`,
        cause: "invalid_confirmation"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep(`Processing ${action}`, { orgId: org_id, reason });

    let result;
    if (action === 'suspend') {
      // Call suspend function
      const { data, error } = await supabaseClient.rpc('suspend_organization', {
        p_org_id: org_id,
        p_reason: reason,
        p_suspended_by: user.id
      });

      if (error) throw error;
      result = data;
    } else if (action === 'cancel') {
      // Call cancel function
      const { data, error } = await supabaseClient.rpc('cancel_organization', {
        p_org_id: org_id,
        p_reason: reason,
        p_canceled_by: user.id
      });

      if (error) throw error;
      result = data;
    } else if (action === 'reinstate') {
      // Call reinstate function
      const { data, error } = await supabaseClient.rpc('reinstate_organization', {
        p_org_id: org_id,
        p_reason: reason,
        p_reinstated_by: user.id
      });

      if (error) throw error;
      result = data;
    } else {
      throw new Error(`Invalid action: ${action}`);
    }

    // Send email notification if requested and in production
    if (notify_owner && Deno.env.get("ENVIRONMENT") === "production") {
      try {
        // Get organization owner email
        const { data: orgData, error: orgError } = await supabaseClient
          .from('organizations')
          .select(`
            name,
            profiles!inner(email)
          `)
          .eq('id', org_id)
          .single();

        if (!orgError && orgData) {
          // Send email notification (implement email service as needed)
          logStep("Email notification would be sent", { 
            to: orgData.profiles.email,
            action,
            orgName: orgData.name
          });
          
          // TODO: Implement actual email sending service
          // const statusText = action === 'suspend' ? 'Suspended' : action === 'cancel' ? 'Canceled' : 'Reinstated';
          // await sendEmail({
          //   to: orgData.profiles.email,
          //   subject: `Organization ${statusText}: ${orgData.name}`,
          //   body: `Your organization "${orgData.name}" has been ${action}d. Reason: ${reason}`
          // });
        }
      } catch (emailError) {
        logStep("Email notification failed", { error: emailError.message });
        // Don't fail the main operation if email fails
      }
    }

    logStep(`${action} completed successfully`, result);

    return new Response(JSON.stringify({
      success: true,
      action,
      org_id,
      result
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Categorize error types
    if (error instanceof Error) {
      if (errorMessage.includes('organization not found') || errorMessage.includes('does not exist')) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Organization not found",
          hint: "Check that the organization ID exists in the database",
          cause: "org_not_found"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      
      if (errorMessage.includes('already suspended') || errorMessage.includes('already active')) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Invalid state transition",
          hint: "Organization is already in the requested state",
          cause: "invalid_state"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }
    
    // Generic server error
    return new Response(JSON.stringify({
      ok: false,
      error: "Unexpected server error",
      hint: "Check function logs for details",
      cause: "server_error"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});