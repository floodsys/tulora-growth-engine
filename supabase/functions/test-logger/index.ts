import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireSuperadmin } from '../_shared/requireSuperadmin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestLogRequest {
  sessionId: string;
  orgId: string;
  testType: 'smoke' | 'full';
  testSuite: string;
  testName: string;
  status: 'passed' | 'failed' | 'error';
  message?: string;
  details?: any;
  durationMs?: number;
  environment?: string;
  gitCommit?: string;
  testRunner?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce superadmin access
  const guardResult = await requireSuperadmin(req, 'test-logger');
  if (!guardResult.ok) {
    return guardResult.response!;
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TestLogRequest = await req.json();

    // Validate required fields
    if (!body.sessionId || !body.orgId || !body.testType || !body.testSuite || !body.testName || !body.status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to server with test_invites channel
    console.log(JSON.stringify({
      channel: 'test_invites',
      level: body.status === 'passed' ? 'info' : 'error',
      sessionId: body.sessionId,
      orgId: body.orgId,
      testType: body.testType,
      testSuite: body.testSuite,
      testName: body.testName,
      status: body.status,
      message: body.message,
      details: body.details,
      durationMs: body.durationMs,
      environment: body.environment || 'web',
      testRunner: body.testRunner || 'web',
      timestamp: new Date().toISOString()
    }));

    // Store in database using the log_test_outcome function
    const { data, error } = await supabase.rpc('log_test_outcome', {
      p_session_id: body.sessionId,
      p_org_id: body.orgId,
      p_test_type: body.testType,
      p_test_suite: body.testSuite,
      p_test_name: body.testName,
      p_status: body.status,
      p_message: body.message || null,
      p_details: body.details || {},
      p_duration_ms: body.durationMs || null,
      p_environment: body.environment || 'web',
      p_git_commit: body.gitCommit || null,
      p_test_runner: body.testRunner || 'web'
    });

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to log test outcome', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, logId: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Test logger error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});