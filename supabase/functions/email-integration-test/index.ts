import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailTestResult {
  ok: boolean;
  provider: string;
  status: string;
  reason?: string;
  details?: any;
}

// Note: We'll create the client with user auth in the serve function

async function testResendConnectivity(): Promise<EmailTestResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!apiKey) {
    return {
      ok: false,
      provider: 'resend',
      status: 'No API Key',
      reason: 'RESEND_API_KEY environment variable not configured'
    };
  }

  try {
    const resend = new Resend(apiKey);
    
    // Test API connectivity by listing domains (lightweight operation)
    const domainsResponse = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!domainsResponse.ok) {
      const errorText = await domainsResponse.text();
      return {
        ok: false,
        provider: 'resend',
        status: 'Auth Failed',
        reason: `API authentication failed: ${domainsResponse.status} ${errorText}`,
        details: { status: domainsResponse.status }
      };
    }

    const domains = await domainsResponse.json();
    
    return {
      ok: true,
      provider: 'resend',
      status: 'Connected',
      details: { 
        domains_count: domains.data?.length || 0,
        verified_domains: domains.data?.filter((d: any) => d.status === 'verified').length || 0
      }
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'resend',
      status: 'Connection Error',
      reason: `Network or DNS error: ${error.message}`,
      details: { error: error.message }
    };
  }
}

async function testSMTPConnectivity(): Promise<EmailTestResult> {
  const host = Deno.env.get('SMTP_HOST');
  const port = Deno.env.get('SMTP_PORT');
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');

  if (!host || !port || !user || !pass) {
    return {
      ok: false,
      provider: 'smtp',
      status: 'Incomplete Config',
      reason: 'Missing SMTP configuration variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)'
    };
  }

  try {
    // Basic connectivity test - try to connect to SMTP server
    const conn = await Deno.connect({
      hostname: host,
      port: parseInt(port),
    });
    conn.close();

    return {
      ok: true,
      provider: 'smtp',
      status: 'Connected',
      details: { host, port }
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'smtp',
      status: 'Connection Failed',
      reason: `Cannot connect to SMTP server: ${error.message}`,
      details: { host, port, error: error.message }
    };
  }
}

async function testSendGridConnectivity(): Promise<EmailTestResult> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  
  if (!apiKey) {
    return {
      ok: false,
      provider: 'sendgrid',
      status: 'No API Key',
      reason: 'SENDGRID_API_KEY environment variable not configured'
    };
  }

  try {
    // Test API connectivity
    const response = await fetch('https://api.sendgrid.com/v3/user/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        provider: 'sendgrid',
        status: 'Auth Failed',
        reason: `API authentication failed: ${response.status} ${errorText}`,
        details: { status: response.status }
      };
    }

    const account = await response.json();
    
    return {
      ok: true,
      provider: 'sendgrid',
      status: 'Connected',
      details: { account_type: account.type || 'unknown' }
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'sendgrid',
      status: 'Connection Error',
      reason: `Network or DNS error: ${error.message}`,
      details: { error: error.message }
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const { data: isSuperadmin, error: authError } = await supabaseClient.rpc('is_superadmin');
    
    if (authError || !isSuperadmin) {
      console.error('Superadmin check failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run email provider tests in parallel
    const [resendResult, smtpResult, sendgridResult] = await Promise.all([
      testResendConnectivity(),
      testSMTPConnectivity(),
      testSendGridConnectivity(),
    ]);

    const results = [resendResult, smtpResult, sendgridResult];
    const configuredProviders = results.filter(r => r.status !== 'No API Key' && r.status !== 'Incomplete Config');
    const workingProviders = results.filter(r => r.ok);

    let overallStatus = 'No Providers';
    if (configuredProviders.length === 0) {
      overallStatus = 'No Providers';
    } else if (workingProviders.length === 0) {
      overallStatus = 'All Failed';
    } else if (workingProviders.length === configuredProviders.length) {
      overallStatus = 'All Working';
    } else {
      overallStatus = 'Partial';
    }

    return new Response(
      JSON.stringify({
        ok: workingProviders.length > 0,
        status: overallStatus,
        summary: `${workingProviders.length}/${configuredProviders.length} working`,
        providers: results,
        details: {
          configured_count: configuredProviders.length,
          working_count: workingProviders.length,
          tested_at: new Date().toISOString(),
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Email integration test error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        status: 'Test Error',
        reason: `Test execution failed: ${error.message}`,
        error: error.message
      }),
      {
        status: 200, // Return 200 with ok:false as requested
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});