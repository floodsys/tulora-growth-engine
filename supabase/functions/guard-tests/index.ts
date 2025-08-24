import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestRequest {
  organizationId: string;
  testType: 'guard' | 'rls';
  scenario: 'suspended' | 'canceled' | 'active';
  operation: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { organizationId, testType, scenario, operation }: TestRequest = await req.json();

    console.log(`Running ${testType} test: ${operation} with ${scenario} org`);

    const testResults = {
      testType,
      scenario,
      operation,
      organizationId,
      timestamp: new Date().toISOString(),
      results: {} as any
    };

    if (testType === 'guard') {
      testResults.results = await runGuardTests(organizationId, scenario, operation);
    } else if (testType === 'rls') {
      testResults.results = await runRLSTests(supabase, organizationId, scenario, operation);
    }

    return new Response(
      JSON.stringify(testResults),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Guard test error:', error);
    return new Response(
      JSON.stringify({ error: 'Test execution failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function runGuardTests(organizationId: string, scenario: string, operation: string) {
  const baseUrl = `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.functions.supabase.co`;
  const results: any = {};

  // Test different endpoints based on operation
  switch (operation) {
    case 'agent_operations':
      results.agent_management = await testEndpoint(
        `${baseUrl}/agent-management`,
        {
          type: 'agent',
          action: 'created',
          organizationId,
          agentId: 'test-agent-id',
          agentName: 'Test Agent'
        },
        scenario === 'suspended' ? 423 : scenario === 'canceled' ? 410 : 200
      );

      results.agents_update = await testEndpoint(
        `${baseUrl}/agents`,
        {
          method: 'PATCH',
          agentId: 'test-agent-id',
          organizationId,
          name: 'Updated Agent'
        },
        scenario === 'suspended' ? 423 : scenario === 'canceled' ? 410 : 200
      );
      break;

    case 'webhook_operations':
      results.send_webhook = await testEndpoint(
        `${baseUrl}/send-webhook`,
        {
          event: {
            organization_id: organizationId,
            event_id: 'test-event-id',
            action: 'test.action',
            target_type: 'test',
            actor_user_id: 'test-user-id',
            actor_role_snapshot: 'admin',
            status: 'success',
            channel: 'audit',
            created_at: new Date().toISOString(),
            metadata: { test: true }
          }
        },
        scenario === 'suspended' ? 423 : scenario === 'canceled' ? 410 : 200
      );
      break;

    case 'invite_operations':
      results.invite_create = await testEndpoint(
        `${baseUrl}/invite-management`,
        {
          action: 'create',
          organizationId,
          email: 'test@example.com',
          role: 'user'
        },
        scenario === 'suspended' ? 423 : scenario === 'canceled' ? 410 : 200
      );
      break;

    case 'billing_operations':
      // Billing should always be allowed
      results.billing_portal = await testEndpoint(
        `${baseUrl}/org-customer-portal`,
        { orgId: organizationId },
        200 // Always allowed
      );
      break;

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  return results;
}

async function runRLSTests(supabase: any, organizationId: string, scenario: string, operation: string) {
  const results: any = {};

  // Test direct database operations to verify RLS blocks them
  switch (operation) {
    case 'agent_operations':
      results.agent_insert = await testRLSOperation(
        () => supabase.from('agent_profiles').insert({
          organization_id: organizationId,
          name: 'RLS Test Agent',
          retell_agent_id: 'test-rls-agent',
          system_prompt: 'Test prompt'
        }),
        scenario === 'active'
      );

      results.agent_update = await testRLSOperation(
        () => supabase.from('agent_profiles')
          .update({ name: 'Updated RLS Agent' })
          .eq('organization_id', organizationId),
        scenario === 'active'
      );
      break;

    case 'invite_operations':
      results.invite_insert = await testRLSOperation(
        () => supabase.from('organization_invitations').insert({
          organization_id: organizationId,
          email: 'rls-test@example.com',
          role: 'user',
          invite_token: 'test-token-' + Date.now()
        }),
        scenario === 'active'
      );
      break;

    case 'call_operations':
      results.call_insert = await testRLSOperation(
        () => supabase.from('calls').insert({
          organization_id: organizationId,
          phone_number: '+1234567890',
          status: 'scheduled'
        }),
        scenario === 'active'
      );
      break;

    case 'usage_operations':
      results.usage_insert = await testRLSOperation(
        () => supabase.from('usage_events').insert({
          organization_id: organizationId,
          event_type: 'test_event',
          quantity: 1
        }),
        scenario === 'active'
      );
      break;

    default:
      throw new Error(`Unknown RLS operation: ${operation}`);
  }

  return results;
}

async function testEndpoint(url: string, payload: any, expectedStatus: number) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json().catch(() => null);

    return {
      url,
      expectedStatus,
      actualStatus: response.status,
      success: response.status === expectedStatus,
      response: responseData,
      blocked: response.status === 423 || response.status === 410,
      audit_logged: responseData?.code === 'suspended' || responseData?.code === 'canceled'
    };
  } catch (error) {
    return {
      url,
      expectedStatus,
      actualStatus: 'ERROR',
      success: false,
      error: error.message
    };
  }
}

async function testRLSOperation(operation: () => Promise<any>, shouldSucceed: boolean) {
  try {
    const result = await operation();
    
    return {
      expectedSuccess: shouldSucceed,
      actualSuccess: !result.error,
      success: shouldSucceed ? !result.error : !!result.error,
      error: result.error?.message,
      data: result.data,
      blocked_by_rls: !!result.error && result.error.message?.includes('policy')
    };
  } catch (error) {
    return {
      expectedSuccess: shouldSucceed,
      actualSuccess: false,
      success: !shouldSucceed, // If we expected failure and got an error, that's success
      error: error.message,
      blocked_by_rls: error.message?.includes('policy') || error.message?.includes('row-level security')
    };
  }
}