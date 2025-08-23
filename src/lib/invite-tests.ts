import { supabase } from "@/integrations/supabase/client";
import { createInvite, acceptInvite } from "./invite-helpers";

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

// Test utilities
async function createTestOrganization(): Promise<string> {
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
  const { error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: userId,
      role,
      seat_active: true
    });

  if (error) throw new Error(`Failed to add member: ${error.message}`);
}

async function createSecondaryUser(): Promise<{ email: string; password: string }> {
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

// Admin permission tests
export async function testAdminPermissions(orgId: string): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Can call create_invite and receive a token
  try {
    const inviteResult = await createInvite({
      p_org: orgId,
      p_email: 'admin-test@example.com',
      p_role: 'viewer'
    });

    results.push({
      testName: 'Admin can create invite',
      passed: inviteResult.success && !!inviteResult.token,
      message: inviteResult.success 
        ? `Successfully created invite with token: ${inviteResult.token?.substring(0, 10)}...`
        : `Failed to create invite: ${inviteResult.error}`,
      details: inviteResult
    });
  } catch (error) {
    results.push({
      testName: 'Admin can create invite',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 2: Can read organization_invitations
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

  // Test 3: Can update roles in organization_members
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

// Non-admin member permission tests
export async function testMemberPermissions(orgId: string): Promise<TestSuite> {
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
        email: 'unauthorized@example.com',
        role: 'viewer',
        invite_token: 'test-token'
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

// Invite flow tests
export async function testInviteFlow(orgId: string): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: accept_invite with valid token creates/updates membership
  try {
    // First create an invite
    const inviteResult = await createInvite({
      p_org: orgId,
      p_email: 'flow-test@example.com',
      p_role: 'editor'
    });

    if (inviteResult.success && inviteResult.token) {
      // Try to accept the invite
      const acceptResult = await acceptInvite(inviteResult.token);

      results.push({
        testName: 'Valid token creates membership',
        passed: acceptResult.success,
        message: acceptResult.success 
          ? 'Successfully accepted valid invitation'
          : `Failed to accept invitation: ${acceptResult.error}`,
        details: { inviteResult, acceptResult }
      });

      // Test 2: Reusing same token fails gracefully
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
    } else {
      results.push({
        testName: 'Valid token creates membership',
        passed: false,
        message: `Failed to create test invite: ${inviteResult.error}`,
        details: inviteResult
      });
    }
  } catch (error) {
    results.push({
      testName: 'Valid token creates membership',
      passed: false,
      message: `Error: ${error}`,
      details: error
    });
  }

  // Test 3: Expired tokens fail with clear message
  try {
    const expiredResult = await acceptInvite('expired-or-invalid-token');
    
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

  const passed = results.every(r => r.passed);
  return {
    suiteName: 'Invite Flow',
    results,
    passed,
    summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`
  };
}

// Data integrity tests
export async function testDataIntegrity(orgId: string): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Role values are normalized to lowercase and valid
  try {
    const inviteResult = await createInvite({
      p_org: orgId,
      p_email: 'role-test@example.com',
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
      p_email: 'invalid-role-test@example.com',
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

// Run all tests
export async function runAllTests(orgId?: string): Promise<TestSuite[]> {
  const testOrgId = orgId || await createTestOrganization();
  
  const suites = await Promise.all([
    testAdminPermissions(testOrgId),
    testMemberPermissions(testOrgId),
    testInviteFlow(testOrgId),
    testDataIntegrity(testOrgId)
  ]);

  return suites;
}