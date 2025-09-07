import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireSuperadmin } from '../_shared/requireSuperadmin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SmokeTestRequest {
  organizationId: string;
  suspendFirst?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce superadmin access
  const guardResult = await requireSuperadmin(req, 'smoke-tests');
  if (!guardResult.ok) {
    return guardResult.response!;
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { organizationId, suspendFirst = true }: SmokeTestRequest = await req.json();

    console.log(`Running smoke tests for organization: ${organizationId}`);

    const testResults = {
      organizationId,
      timestamp: new Date().toISOString(),
      testSequence: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: []
      }
    } as any;

    // Test sequence: active -> suspended -> canceled -> active
    const testSequence = suspendFirst 
      ? ['active', 'suspended', 'canceled', 'active']
      : ['suspended', 'canceled', 'active'];

    for (const status of testSequence) {
      console.log(`\n=== Testing with status: ${status} ===`);
      
      // Set organization status
      await setOrganizationStatus(supabase, organizationId, status);
      
      // Wait a moment for any caching to clear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const statusTests = await runStatusTests(organizationId, status);
      testResults.testSequence.push(statusTests);
      
      // Update summary
      testResults.summary.totalTests += statusTests.totalTests;
      testResults.summary.passed += statusTests.passed;
      testResults.summary.failed += statusTests.failed;
      testResults.summary.errors.push(...statusTests.errors);
    }

    // Final verification: ensure organization is back to active
    await setOrganizationStatus(supabase, organizationId, 'active');

    testResults.summary.overallSuccess = testResults.summary.failed === 0;

    return new Response(
      JSON.stringify(testResults),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Smoke test error:', error);
    return new Response(
      JSON.stringify({ error: 'Smoke test execution failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function setOrganizationStatus(supabase: any, organizationId: string, status: string) {
  const statusData: any = { suspension_status: status };
  
  if (status === 'suspended') {
    statusData.suspension_reason = 'Test suspension';
    statusData.suspended_at = new Date().toISOString();
    statusData.suspended_by = 'test-user';
  } else if (status === 'canceled') {
    statusData.suspension_reason = 'Test cancellation';
    statusData.canceled_at = new Date().toISOString();
    statusData.suspended_by = 'test-user';
  } else {
    statusData.suspension_reason = null;
    statusData.suspended_at = null;
    statusData.canceled_at = null;
    statusData.suspended_by = null;
  }

  const { error } = await supabase
    .from('organizations')
    .update(statusData)
    .eq('id', organizationId);

  if (error) {
    throw new Error(`Failed to set organization status to ${status}: ${error.message}`);
  }
  
  console.log(`Organization ${organizationId} status set to: ${status}`);
}

async function runStatusTests(organizationId: string, status: string) {
  const expectedStatus = getExpectedStatus(status);
  const tests = [];
  let passed = 0;
  let failed = 0;
  const errors = [];

  // Test configurations for each operation
  const testConfigs = [
    {
      name: 'Agent Management - Create',
      operation: 'agent_operations',
      endpoint: 'agent-management',
      payload: {
        type: 'agent',
        action: 'created',
        organizationId,
        agentId: `test-agent-${Date.now()}`,
        agentName: 'Smoke Test Agent'
      }
    },
    {
      name: 'Agent Update',
      operation: 'agent_operations', 
      endpoint: 'agents',
      payload: {
        method: 'PATCH',
        agentId: 'test-agent-id',
        organizationId,
        name: 'Updated Smoke Test Agent'
      }
    },
    {
      name: 'Webhook Dispatch',
      operation: 'webhook_operations',
      endpoint: 'send-webhook', 
      payload: {
        event: {
          organization_id: organizationId,
          event_id: `smoke-test-${Date.now()}`,
          action: 'smoke.test',
          target_type: 'test',
          actor_user_id: 'smoke-test-user',
          actor_role_snapshot: 'admin',
          status: 'success',
          channel: 'audit',
          created_at: new Date().toISOString(),
          metadata: { smoke_test: true }
        }
      }
    },
    {
      name: 'Invite Creation',
      operation: 'invite_operations',
      endpoint: 'invite-management',
      payload: {
        action: 'create',
        organizationId,
        email: `smoke-test-${Date.now()}@example.com`,
        role: 'user'
      }
    },
    {
      name: 'Billing Portal (Should Always Work)',
      operation: 'billing_operations',
      endpoint: 'org-customer-portal',
      payload: { orgId: organizationId },
      expectedStatus: 200 // Billing always allowed
    }
  ];

  // Run each test
  for (const config of testConfigs) {
    try {
      const result = await runSingleTest(config, expectedStatus);
      tests.push(result);
      
      if (result.success) {
        passed++;
      } else {
        failed++;
        errors.push(`${config.name}: Expected ${config.expectedStatus || expectedStatus}, got ${result.actualStatus}`);
      }
    } catch (error) {
      failed++;
      errors.push(`${config.name}: ${error.message}`);
      tests.push({
        name: config.name,
        success: false,
        error: error.message
      });
    }
  }

  // Run RLS bypass tests
  const rlsTests = await runRLSBypassTests(organizationId, status);
  tests.push(...rlsTests.tests);
  passed += rlsTests.passed;
  failed += rlsTests.failed;
  errors.push(...rlsTests.errors);

  return {
    status,
    totalTests: tests.length,
    passed,
    failed,
    errors,
    tests
  };
}

async function runSingleTest(config: any, expectedStatus: number) {
  const baseUrl = `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.functions.supabase.co`;
  const url = `${baseUrl}/${config.endpoint}`;
  const testExpectedStatus = config.expectedStatus || expectedStatus;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(config.payload)
    });

    const responseData = await response.json().catch(() => null);

    return {
      name: config.name,
      operation: config.operation,
      expectedStatus: testExpectedStatus,
      actualStatus: response.status,
      success: response.status === testExpectedStatus,
      response: responseData,
      blocked: response.status === 423 || response.status === 410,
      audit_logged: responseData?.code === 'suspended' || responseData?.code === 'canceled'
    };
  } catch (error) {
    return {
      name: config.name,
      operation: config.operation,
      expectedStatus: testExpectedStatus,
      actualStatus: 'ERROR',
      success: false,
      error: error.message
    };
  }
}

async function runRLSBypassTests(organizationId: string, status: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const shouldSucceed = status === 'active';
  const tests = [];
  let passed = 0;
  let failed = 0;
  const errors = [];

  // Direct database operations that should be blocked by RLS
  const rlsOperations = [
    {
      name: 'RLS Block - Agent Insert',
      operation: () => supabase.from('agent_profiles').insert({
        organization_id: organizationId,
        name: `RLS Test Agent ${Date.now()}`,
        retell_agent_id: `rls-test-${Date.now()}`,
        system_prompt: 'RLS Test prompt'
      })
    },
    {
      name: 'RLS Block - Call Insert', 
      operation: () => supabase.from('calls').insert({
        organization_id: organizationId,
        phone_number: '+1234567890',
        status: 'scheduled',
        metadata: { rls_test: true }
      })
    },
    {
      name: 'RLS Block - Invite Insert',
      operation: () => supabase.from('organization_invitations').insert({
        organization_id: organizationId,
        email: `rls-test-${Date.now()}@example.com`,
        role: 'user',
        invite_token: `rls-test-token-${Date.now()}`
      })
    },
    {
      name: 'RLS Block - Usage Event Insert',
      operation: () => supabase.from('usage_events').insert({
        organization_id: organizationId,
        event_type: 'rls_test_event',
        quantity: 1
      })
    }
  ];

  for (const rlsOp of rlsOperations) {
    try {
      const result = await rlsOp.operation();
      const operationSucceeded = !result.error;
      const testPassed = shouldSucceed === operationSucceeded;
      
      tests.push({
        name: rlsOp.name,
        expectedSuccess: shouldSucceed,
        actualSuccess: operationSucceeded,
        success: testPassed,
        error: result.error?.message,
        blocked_by_rls: !!result.error && (
          result.error.message?.includes('policy') || 
          result.error.message?.includes('row-level security')
        )
      });

      if (testPassed) {
        passed++;
      } else {
        failed++;
        errors.push(`${rlsOp.name}: Expected ${shouldSucceed ? 'success' : 'failure'}, got ${operationSucceeded ? 'success' : 'failure'}`);
      }
    } catch (error) {
      const testPassed = !shouldSucceed; // If we expected failure and got an exception, that's success
      tests.push({
        name: rlsOp.name,
        expectedSuccess: shouldSucceed,
        actualSuccess: false,
        success: testPassed,
        error: error.message,
        blocked_by_rls: error.message?.includes('policy') || error.message?.includes('row-level security')
      });

      if (testPassed) {
        passed++;
      } else {
        failed++;
        errors.push(`${rlsOp.name}: ${error.message}`);
      }
    }
  }

  return { tests, passed, failed, errors };
}

function getExpectedStatus(status: string): number {
  switch (status) {
    case 'active':
      return 200;
    case 'suspended':
      return 423;
    case 'canceled':
      return 410;
    default:
      return 500;
  }
}