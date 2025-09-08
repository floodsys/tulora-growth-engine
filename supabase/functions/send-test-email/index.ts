import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestEmailRequest {
  to: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
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

    // Get user data
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Check if user is organization owner or admin
    const { data: userOrg, error: orgError } = await supabaseClient
      .from('organizations')
      .select('id, name')
      .eq('owner_user_id', user.id)
      .single();

    if (orgError && orgError.code !== 'PGRST116') {
      console.error('Error checking organization ownership:', orgError);
      return new Response(JSON.stringify({ error: "database_error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!userOrg) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { to }: TestEmailRequest = await req.json();

    if (!to) {
      return new Response(JSON.stringify({ error: "Email address is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: "Email service not configured - RESEND_API_KEY missing" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const resend = new Resend(apiKey);

    const emailResponse = await resend.emails.send({
      from: "Tulora Test <onboarding@resend.dev>",
      to: [to],
      subject: "Test Email from Tulora",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
          <h1 style="color: #333; margin-bottom: 20px;">Email Configuration Test</h1>
          <p style="color: #666; line-height: 1.6;">
            This is a test email to verify that your Tulora email configuration is working correctly.
          </p>
          <p style="color: #666; line-height: 1.6;">
            <strong>Organization:</strong> ${userOrg.name}<br>
            <strong>Sent at:</strong> ${new Date().toISOString()}<br>
            <strong>Sent to:</strong> ${to}
          </p>
          <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
            <p style="margin: 0; color: #28a745; font-weight: 500;">
              ✅ Email configuration is working properly!
            </p>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error('Resend error:', emailResponse.error);
      return new Response(JSON.stringify({ 
        ok: false,
        error: `Failed to send email: ${emailResponse.error.message}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Log the test email activity
    await supabaseClient
      .from('audit_log')
      .insert({
        organization_id: userOrg.id,
        actor_user_id: user.id,
        actor_role_snapshot: 'admin',
        action: 'email.test_sent',
        target_type: 'email',
        target_id: to,
        status: 'success',
        channel: 'audit',
        metadata: {
          email_id: emailResponse.data?.id,
          timestamp: new Date().toISOString(),
          provider: 'resend'
        }
      });

    return new Response(JSON.stringify({
      ok: true,
      message: "Test email sent successfully",
      email_id: emailResponse.data?.id,
      sent_to: to
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Test email error:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: `Failed to send test email: ${error.message}`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});