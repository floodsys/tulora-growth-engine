import { supabase } from "@/integrations/supabase/client";
import { createInvite, acceptInvite } from "./invite-helpers";

// Test logging utilities
let currentSessionId: string | null = null;

export function generateTestSessionId(): string {
  currentSessionId = crypto.randomUUID();
  return currentSessionId;
}

export function getCurrentSessionId(): string {
  return currentSessionId || generateTestSessionId();
}

export async function logTestOutcome(
  orgId: string,
  testType: 'smoke' | 'full',
  testSuite: string,
  testName: string,
  status: 'passed' | 'failed' | 'error',
  message?: string,
  details?: any,
  durationMs?: number
) {
  try {
    const sessionId = getCurrentSessionId();
    
    // Log to server with test_invites channel via edge function
    await supabase.functions.invoke('test-logger', {
      body: {
        sessionId,
        orgId,
        testType,
        testSuite,
        testName,
        status,
        message,
        details,
        durationMs,
        environment: import.meta.env.MODE || 'development',
        testRunner: 'web'
      }
    });
  } catch (error) {
    console.error('Failed to log test outcome:', error);
    // Don't fail tests due to logging issues
  }
}

export interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface TestSuite {
  suiteName: string;
  results: TestResult[];
  passed: boolean;
  summary: string;
}

export type TestLevel = 'full' | 'smoke' | 'off';

// Get current test level from environment
export function getTestLevel(): TestLevel {
  return 'off'; // Default to off since we're not using environment variables
}

// Get test organization ID
export function getTestOrgId(): string | null {
  return null; // Not using environment variables for test org ID
}

// Check if email delivery is disabled for tests
export function isEmailDeliveryDisabled(): boolean {
  return false; // Default to false since we're not using environment variables
}

// Get analytics excluded organizations
export function getAnalyticsExcludedOrgs(): string[] {
  return []; // Return empty array since we're not using environment variables
}

// Check if tests are enabled
export function isTestingEnabled(): boolean {
  return getTestLevel() !== 'off';
}

// Check if write operations are allowed
export function areWriteTestsEnabled(): boolean {
  return getTestLevel() === 'full';
}

// Check if test setup is valid
export function isTestSetupValid(): { valid: boolean; message?: string } {
  if (!isTestingEnabled()) {
    return { valid: false, message: 'Testing is disabled (RUN_TEST_LEVEL=off)' };
  }
  
  const testOrgId = getTestOrgId();
  if (!testOrgId) {
    return { 
      valid: false, 
      message: 'TEST_ORG_ID is required for testing. Please configure a dedicated test organization.' 
    };
  }
  
  return { valid: true };
}

// Test utilities
async function createTestOrganization(): Promise<string> {
  // Always use the configured test org ID if available
  const testOrgId = getTestOrgId();
  if (testOrgId) {
    return testOrgId;
  }
  
  if (!areWriteTestsEnabled()) {
    throw new Error('Write operations disabled in current test level');
  }
  
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: `Test Org ${Date.now()}`,
      slug: `test-org-${Date.now()}`
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create test org: ${error.message}`);
  return data.id;
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  return user.id;
}

async function addMemberToOrg(orgId: string, userId: string, role: string): Promise<void> {
  if (!areWriteTestsEnabled()) {
    throw new Error('Write operations disabled in current test level');
  }
  
  // Ensure role is valid for the enum
  const validRole = ['admin', 'editor', 'viewer', 'user'].includes(role) ? role : 'user';
  
  const { error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: userId,
      role: validRole as 'admin' | 'editor' | 'viewer' | 'user',
      seat_active: true
    });

  if (error) throw new Error(`Failed to add member: ${error.message}`);
}

async function createSecondaryUser(): Promise<{ email: string; password: string }> {
  if (!areWriteTestsEnabled()) {
    throw new Error('Write operations disabled in current test level');
  }
  
  const email = `test-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`
    }
  });

  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  return { email, password };
}

// Smoke test for reading organization data (read-only) - export for direct use
export async function testReadOnlyAccess(orgId: string): Promise<TestSuite> {
  const results: TestResult[] = [];
  
  // Validate we're using the test org
  const testOrgId = getTestOrgId();
  if (testOrgId && orgId !== testOrgId) {
    results.push({
      testName: 'Test Organization Validation',
      passed: false,
      message: `Test must use configured TEST_ORG_ID (${testOrgId}), got: ${orgId}`,
      details: { expectedOrgId: testOrgId, actualOrgId: orgId }
    });
  }

  // Test 1: Validate test environment isolation
  try {
    results.push({
      testName: 'Test Environment Configuration',
      passed: !!testOrgId && isEmailDeliveryDisabled(),
      message: testOrgId && isEmailDeliveryDisabled() 
        ? 'Test environment properly configured with isolation'
        : 'Test environment not properly configured',
      details: { 
        testOrgId,
        emailDeliveryDisabled: isEmailDeliveryDisabled(),
        testLevel: getTestLevel()
      }
    });
  } catch (error) {
    results.push({
      testName: 'Test Environment Configuration',
      passed: false,
      message: `Error checking test configuration: ${error}`,
      details: error
    });
  }

  // Test 2: Can read organization data
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId);

    results.push({
      testName: 'Can read organization data',
      passed: !error,
      message: error ? `Failed to read organization: ${error.message}` : 'Successfully read organization data',
      details: { error, found: !!data?.length }
    });
  } catch (error) {
    results.push({
      testName: 'Can read organization data',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 3: Can read organization members
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId);

    results.push({
      testName: 'Can read organization members',
      passed: !error,
      message: error ? `Failed to read members: ${error.message}` : `Successfully read ${data?.length || 0} members`,
      details: { error, dataCount: data?.length }
    });
  } catch (error) {
    results.push({
      testName: 'Can read organization members',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 4: Can read invitations (read-only)
  try {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', orgId);

    results.push({
      testName: 'Can read invitations',
      passed: !error,
      message: error ? `Failed to read invitations: ${error.message}` : `Successfully read ${data?.length || 0} invitations`,
      details: { error, dataCount: data?.length }
    });
  } catch (error) {
    results.push({
      testName: 'Can read invitations',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  const passed = results.every(r => r.passed);
  return {
    suiteName: 'Read-Only Access (Smoke Test)',
    results,
    passed,
    summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`
  };
}

// Admin permission tests (full test level only)
export async function testAdminPermissions(orgId: string): Promise<TestSuite> {
  // Validate we're using the test org
  const testOrgId = getTestOrgId();
  if (testOrgId && orgId !== testOrgId) {
    return {
      suiteName: 'Admin Permissions',
      results: [{
        testName: 'Test Organization Validation',
        passed: false,
        message: `Test must use configured TEST_ORG_ID (${testOrgId}), got: ${orgId}`,
        details: { expectedOrgId: testOrgId, actualOrgId: orgId }
      }],
      passed: false,
      summary: 'Invalid test organization'
    };
  }

  if (!areWriteTestsEnabled()) {
    return {
      suiteName: 'Admin Permissions',
      results: [{
        testName: 'Admin Permission Tests',
        passed: false,
        message: 'Skipped: Write operations disabled in current test level',
        details: { testLevel: getTestLevel() }
      }],
      passed: false,
      summary: 'Skipped due to test level restrictions'
    };
  }

  const results: TestResult[] = [];

  // Test 1: Validate email delivery is disabled for tests
  try {
    results.push({
      testName: 'Email delivery disabled for tests',
      passed: isEmailDeliveryDisabled(),
      message: isEmailDeliveryDisabled() 
        ? 'Email delivery correctly disabled for tests'
        : 'WARNING: Email delivery enabled during tests - may send real emails!',
      details: { emailDeliveryDisabled: isEmailDeliveryDisabled() }
    });
  } catch (error) {
    results.push({
      testName: 'Email delivery disabled for tests',
      passed: false,
      message: `Error checking email configuration: ${error}`,
      details: error
    });
  }

  // Test 2: Can call create_invite and receive a token
  try {
    const inviteResult = await createInvite({
      p_org: orgId,
      p_email: `test-admin-${Date.now()}@example.com`, // Use timestamped email for tests
      p_role: 'viewer'
    });

    results.push({
      testName: 'Admin can create invite (test mode)',
      passed: inviteResult.success && !!inviteResult.token,
      message: inviteResult.success
        ? `Successfully created invite with token: ${inviteResult.token?.substring(0, 10)}...`
        : `Failed to create invite: ${inviteResult.error}`,
      details: inviteResult
    });
  } catch (error) {
    results.push({
      testName: 'Admin can create invite (test mode)',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 3: Can read organization_invitations
  try {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', orgId);

    results.push({
      testName: 'Admin can read invitations',
      passed: !error,
      message: error ? `Failed to read invitations: ${error.message}` : `Successfully read ${data?.length || 0} invitations`,
      details: { error, dataCount: data?.length }
    });
  } catch (error) {
    results.push({
      testName: 'Admin can read invitations',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 4: Can update roles in organization_members
  try {
    const { data: members } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId)
      .limit(1);

    if (members && members.length > 0) {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: 'editor' })
        .eq('organization_id', orgId)
        .eq('user_id', members[0].user_id);

      results.push({
        testName: 'Admin can update member roles',
        passed: !error,
        message: error ? `Failed to update role: ${error.message}` : 'Successfully updated member role',
        details: { error, memberId: members[0].user_id }
      });
    } else {
      results.push({
        testName: 'Admin can update member roles',
        passed: false,
        message: 'No members found to test role update',
        details: null
      });
    }
  } catch (error) {
    results.push({
      testName: 'Admin can update member roles',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  const passed = results.every(r => r.passed);
  return {
    suiteName: 'Admin Permissions',
    results,
    passed,
    summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`
  };
}

// Non-admin member permission tests (full test level only)
export async function testMemberPermissions(orgId: string): Promise<TestSuite> {
  // Validate we're using the test org
  const testOrgId = getTestOrgId();
  if (testOrgId && orgId !== testOrgId) {
    return {
      suiteName: 'Member Permissions',
      results: [{
        testName: 'Test Organization Validation',
        passed: false,
        message: `Test must use configured TEST_ORG_ID (${testOrgId}), got: ${orgId}`,
        details: { expectedOrgId: testOrgId, actualOrgId: orgId }
      }],
      passed: false,
      summary: 'Invalid test organization'
    };
  }

  if (!areWriteTestsEnabled()) {
    return {
      suiteName: 'Member Permissions',
      results: [{
        testName: 'Member Permission Tests',
        passed: false,
        message: 'Skipped: Write operations disabled in current test level',
        details: { testLevel: getTestLevel() }
      }],
      passed: false,
      summary: 'Skipped due to test level restrictions'
    };
  }

  const results: TestResult[] = [];
  const userId = await getCurrentUserId();

  // Ensure user is a non-admin member
  await addMemberToOrg(orgId, userId, 'viewer');

  // Test 1: Can read organizations (if member)
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId);

    results.push({
      testName: 'Member can read organization',
      passed: !error && data && data.length > 0,
      message: error ? `Failed to read organization: ${error.message}` : 'Successfully read organization',
      details: { error, found: !!data?.length }
    });
  } catch (error) {
    results.push({
      testName: 'Member can read organization',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 2: Can read organization_members for same org
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId);

    results.push({
      testName: 'Member can read organization members',
      passed: !error,
      message: error ? `Failed to read members: ${error.message}` : `Successfully read ${data?.length || 0} members`,
      details: { error, dataCount: data?.length }
    });
  } catch (error) {
    results.push({
      testName: 'Member can read organization members',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 3: Cannot create organization_invitations (expect RLS error)
  try {
    const { error } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: orgId,
        email: `test-unauthorized-${Date.now()}@example.com`, // Use timestamped email for tests
        role: 'viewer',
        invite_token: `test-token-${Date.now()}`
      });

    results.push({
      testName: 'Member cannot create invitations',
      passed: !!error, // Should fail with RLS error
      message: error ? `Correctly blocked: ${error.message}` : 'ERROR: Member was allowed to create invitation!',
      details: { error }
    });
  } catch (error) {
    results.push({
      testName: 'Member cannot create invitations',
      passed: true, // Exception is also acceptable
      message: `Correctly blocked with exception: ${error}`,
      details: error
    });
  }

  // Test 4: Cannot update organization_members (expect RLS error)
  try {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: 'admin' })
      .eq('organization_id', orgId)
      .eq('user_id', userId);

    results.push({
      testName: 'Member cannot update member roles',
      passed: !!error, // Should fail with RLS error
      message: error ? `Correctly blocked: ${error.message}` : 'ERROR: Member was allowed to update roles!',
      details: { error }
    });
  } catch (error) {
    results.push({
      testName: 'Member cannot update member roles',
      passed: true, // Exception is also acceptable
      message: `Correctly blocked with exception: ${error}`,
      details: error
    });
  }

  const passed = results.every(r => r.passed);
  return {
    suiteName: 'Member Permissions',
    results,
    passed,
    summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`
  };
}

// Invite flow tests (full test level only)
export async function testInviteFlow(orgId: string): Promise<TestSuite> {
  // Validate we're using the test org
  const testOrgId = getTestOrgId();
  if (testOrgId && orgId !== testOrgId) {
    return {
      suiteName: 'Invite Flow',
      results: [{
        testName: 'Test Organization Validation',
        passed: false,
        message: `Test must use configured TEST_ORG_ID (${testOrgId}), got: ${orgId}`,
        details: { expectedOrgId: testOrgId, actualOrgId: orgId }
      }],
      passed: false,
      summary: 'Invalid test organization'
    };
  }

  if (!areWriteTestsEnabled()) {
    return {
      suiteName: 'Invite Flow',
      results: [{
        testName: 'Invite Flow Tests',
        passed: false,
        message: 'Skipped: Write operations disabled in current test level',
        details: { testLevel: getTestLevel() }
      }],
      passed: false,
      summary: 'Skipped due to test level restrictions'
    };
  }

  const results: TestResult[] = [];

  // Test 1: accept_invite with valid token creates/updates membership (smoke test only generates token)
  try {
    // First create an invite
    const inviteResult = await createInvite({
      p_org: orgId,
      p_email: `test-flow-${Date.now()}@example.com`, // Use timestamped email for tests
      p_role: 'editor'
    });

    if (inviteResult.success && inviteResult.token) {
      // For smoke tests, only validate token generation
      if (getTestLevel() === 'smoke') {
        results.push({
          testName: 'Valid token generation (smoke test)',
          passed: true,
          message: 'Successfully generated valid invitation token',
          details: { tokenGenerated: true, testLevel: 'smoke' }
        });
      } else {
        // Try to accept the invite (full test only)
        const acceptResult = await acceptInvite(inviteResult.token);

        results.push({
          testName: 'Valid token creates membership',
          passed: acceptResult.success,
          message: acceptResult.success 
            ? 'Successfully accepted valid invitation'
            : `Failed to accept invitation: ${acceptResult.error}`,
          details: { inviteResult, acceptResult }
        });

        // Test 2: Reusing same token fails gracefully (full test only)
        if (acceptResult.success) {
          const reAcceptResult = await acceptInvite(inviteResult.token);
          
          results.push({
            testName: 'Reusing token fails gracefully',
            passed: !reAcceptResult.success,
            message: reAcceptResult.success 
              ? 'ERROR: Token was reused successfully!' 
              : `Correctly rejected reused token: ${reAcceptResult.error}`,
            details: reAcceptResult
          });
        }
      }
    } else {
      results.push({
        testName: 'Valid token generation/acceptance',
        passed: false,
        message: `Failed to create test invite: ${inviteResult.error}`,
        details: inviteResult
      });
    }
  } catch (error) {
    results.push({
      testName: 'Valid token generation/acceptance',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 3: Expired tokens fail with clear message (full test only)
  if (getTestLevel() === 'full') {
    try {
    const expiredResult = await acceptInvite(`expired-test-token-${Date.now()}`);
    
    results.push({
        testName: 'Expired/invalid tokens fail clearly',
        passed: !expiredResult.success,
        message: expiredResult.success 
          ? 'ERROR: Invalid token was accepted!' 
          : `Correctly rejected invalid token: ${expiredResult.error}`,
        details: expiredResult
      });
    } catch (error) {
      results.push({
        testName: 'Expired/invalid tokens fail clearly',
        passed: true,
        message: `Correctly failed with exception: ${error}`,
        details: error
      });
    }
  }

  const passed = results.every(r => r.passed);
  return {
    suiteName: 'Invite Flow',
    results,
    passed,
    summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`
  };
}

// Data integrity tests (full test level only)
export async function testDataIntegrity(orgId: string): Promise<TestSuite> {
  // Validate we're using the test org
  const testOrgId = getTestOrgId();
  if (testOrgId && orgId !== testOrgId) {
    return {
      suiteName: 'Data Integrity',
      results: [{
        testName: 'Test Organization Validation',
        passed: false,
        message: `Test must use configured TEST_ORG_ID (${testOrgId}), got: ${orgId}`,
        details: { expectedOrgId: testOrgId, actualOrgId: orgId }
      }],
      passed: false,
      summary: 'Invalid test organization'
    };
  }

  if (!areWriteTestsEnabled()) {
    return {
      suiteName: 'Data Integrity',
      results: [{
        testName: 'Data Integrity Tests',
        passed: false,
        message: 'Skipped: Write operations disabled in current test level',
        details: { testLevel: getTestLevel() }
      }],
      passed: false,
      summary: 'Skipped due to test level restrictions'
    };
  }

  const results: TestResult[] = [];

  // Test 1: Role values are normalized to lowercase and valid
  try {
    const inviteResult = await createInvite({
      p_org: orgId,
      p_email: `test-role-${Date.now()}@example.com`, // Use timestamped email for tests
      p_role: 'EDITOR' // Test uppercase input
    });

      results.push({
      testName: 'Role values are normalized',
      passed: inviteResult.success && inviteResult.role === 'editor',
      message: inviteResult.success 
        ? `Role normalized correctly: ${inviteResult.role}`
        : `Failed to create invite: ${inviteResult.error}`,
      details: inviteResult
    });
  } catch (error) {
    results.push({
      testName: 'Role values are normalized',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 2: Invalid role values are rejected
  try {
    const invalidRoleResult = await createInvite({
      p_org: orgId,
      p_email: `test-invalid-role-${Date.now()}@example.com`, // Use timestamped email for tests
      p_role: 'invalid_role'
    });

    results.push({
      testName: 'Invalid roles are rejected',
      passed: !invalidRoleResult.success,
      message: invalidRoleResult.success 
        ? 'ERROR: Invalid role was accepted!'
        : `Correctly rejected invalid role: ${invalidRoleResult.error}`,
      details: invalidRoleResult
    });
  } catch (error) {
    results.push({
      testName: 'Invalid roles are rejected',
      passed: true,
      message: `Correctly failed with exception: ${error}`,
      details: error
    });
  }

  // Test 3: (organization_id, user_id) uniqueness is enforced
  try {
    const userId = await getCurrentUserId();
    
    // Try to insert duplicate membership
    const { error: duplicateError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: userId,
        role: 'viewer',
        seat_active: true
      });

    results.push({
      testName: 'Unique constraint enforced',
      passed: !!duplicateError,
      message: duplicateError 
        ? `Correctly enforced uniqueness: ${duplicateError.message}`
        : 'ERROR: Duplicate membership was allowed!',
      details: { duplicateError }
    });
  } catch (error) {
    results.push({
      testName: 'Unique constraint enforced',
      passed: true,
      message: `Correctly failed with exception: ${error}`,
      details: error
    });
  }

  const passed = results.every(r => r.passed);
  return {
    suiteName: 'Data Integrity',
    results,
    passed,
    summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`
  };
}

// Run all tests based on test level
export async function runAllTests(orgId?: string): Promise<TestSuite[]> {
  const testLevel = getTestLevel();
  const testSetup = isTestSetupValid();
  
  if (!testSetup.valid) {
    return [{
      suiteName: 'Test Setup',
      results: [{
        testName: 'Test Configuration',
        passed: false,
        message: testSetup.message || 'Test setup invalid',
        details: { 
          testLevel,
          testOrgId: getTestOrgId(),
          emailDeliveryDisabled: isEmailDeliveryDisabled()
        }
      }],
      passed: false,
      summary: 'Test configuration invalid'
    }];
  }

  // Always use the configured test org ID
  const testOrgId = getTestOrgId()!;
  
  if (orgId && orgId !== testOrgId) {
    return [{
      suiteName: 'Test Organization Validation',
      results: [{
        testName: 'Organization Validation',
        passed: false,
        message: `Tests must use configured TEST_ORG_ID (${testOrgId}), got: ${orgId}`,
        details: { expectedOrgId: testOrgId, actualOrgId: orgId }
      }],
      passed: false,
      summary: 'Invalid test organization'
    }];
  }

  // For smoke tests, run read-only tests
  if (testLevel === 'smoke') {
    return [await testReadOnlyAccess(testOrgId)];
  }

  // For full tests, run all test suites
  const suites = await Promise.all([
    testAdminPermissions(testOrgId),
    testMemberPermissions(testOrgId), 
    testInviteFlow(testOrgId),
    testDataIntegrity(testOrgId)
  ]);

  return suites;
}