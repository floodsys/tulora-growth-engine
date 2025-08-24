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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    // TODO: Add proper admin role check
    logStep("User authenticated", { userId: user.id, email: user.email });

    const body: SuspensionRequest = await req.json();
    const { action, org_id, reason, confirmation_phrase, notify_owner } = body;

    if (!org_id || !reason || !confirmation_phrase) {
      throw new Error("Missing required fields: org_id, reason, confirmation_phrase");
    }

    // Validate confirmation phrase
    const expectedPhrase = action === 'suspend' ? 
      `SUSPEND ORG ${org_id}` : 
      action === 'cancel' ?
      `CANCEL ORG ${org_id}` :
      `REINSTATE ORG ${org_id}`;
    
    if (confirmation_phrase !== expectedPhrase) {
      throw new Error(`Invalid confirmation phrase. Expected: "${expectedPhrase}"`);
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
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});