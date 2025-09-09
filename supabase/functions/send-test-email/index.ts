import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MailerConfig {
  apiKey: string;
  notificationsFrom: string;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

class MailerError extends Error {
  public status: number;
  public response?: any;

  constructor(message: string, status: number = 500, response?: any) {
    super(message);
    this.name = 'MailerError';
    this.status = status;
    this.response = response;
  }
}

class Mailer {
  private resend: Resend;
  private config: MailerConfig;

  constructor(config: MailerConfig) {
    this.config = config;
    this.resend = new Resend(config.apiKey);
  }

  static create(): Mailer {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const notificationsFrom = Deno.env.get('NOTIFICATIONS_FROM');

    if (!apiKey) {
      throw new MailerError('RESEND_API_KEY environment variable is required', 500);
    }

    if (!notificationsFrom) {
      throw new MailerError('NOTIFICATIONS_FROM environment variable is required', 500);
    }

    return new Mailer({ apiKey, notificationsFrom });
  }

  async sendMail(options: SendMailOptions): Promise<{ id: string }> {
    const { to, subject, html, from } = options;

    try {
      const emailResponse = await this.resend.emails.send({
        from: from || this.config.notificationsFrom,
        to: [to],
        subject,
        html,
      });

      if (emailResponse.error) {
        console.warn("resend.error", { 
          status: 'send_failed', 
          message: emailResponse.error.message 
        });
        throw new MailerError(
          emailResponse.error.message,
          502,
          emailResponse.error
        );
      }

      return { id: emailResponse.data!.id };
    } catch (error) {
      if (error instanceof MailerError) {
        throw error;
      }
      console.warn("resend.error", { 
        status: 'api_error', 
        message: error.message || 'Unknown error' 
      });
      throw new MailerError(error.message || 'Email service error', 502, error);
    }
  }
}

interface TestEmailRequest {
  to?: string;
  subject?: string;
  html?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT (authenticated users only)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
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

    // Get user data to verify authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid or expired token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Parse request body
    const body: TestEmailRequest = await req.json();

    // Validate required fields
    if (!body.to || body.to.trim() === '') {
      return new Response(JSON.stringify({ ok: false, error: "Missing 'to'" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Set defaults
    const to = body.to.trim();
    const subject = body.subject || "Tulora — admin test";
    const html = body.html || "<p>Test</p>";

    // Create mailer and send email
    const mailer = Mailer.create();
    const result = await mailer.sendMail({ to, subject, html });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    if (error instanceof MailerError) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Email send failed",
        detail: error.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }

    return new Response(JSON.stringify({
      ok: false,
      error: "Email send failed",
      detail: error.message || 'Unknown error'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 502,
    });
  }
});