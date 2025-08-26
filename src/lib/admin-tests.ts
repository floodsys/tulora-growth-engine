import { supabase } from '@/integrations/supabase/client';
import { getEnvironmentConfig } from '@/lib/environment';

// Test utilities
let currentTestSessionId: string | null = null;

export function generateAdminTestSessionId(): string {
  currentTestSessionId = 'admin_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  return currentTestSessionId;
}

export function getCurrentAdminSessionId(): string {
  if (!currentTestSessionId) {
    currentTestSessionId = generateAdminTestSessionId();
  }
  return currentTestSessionId;
}

export async function logAdminTestOutcome(
  testName: string,
  status: 'pass' | 'fail' | 'skip',
  message?: string,
  details?: any,
  duration?: number
) {
  try {
    await supabase.functions.invoke('test-logger', {
      body: {
        session_id: getCurrentAdminSessionId(),
        test_type: 'admin_acceptance',
        test_suite: 'admin_dashboard',
        test_name: testName,
        status,
        message,
        details,
        duration_ms: duration
      }
    });
  } catch (error) {
    console.error('Failed to log admin test outcome:', error);
  }
}

// Test types
export interface AdminTestResult {
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  details?: any;
  duration?: number;
}

export interface AdminTestSuite {
  suiteName: string;
  results: AdminTestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
}

export type AdminTestLevel = 'full' | 'smoke' | 'off';

// Test configuration
export function getAdminTestLevel(): AdminTestLevel {
  const envConfig = getEnvironmentConfig();
  return envConfig.testLevel as AdminTestLevel;
}

export function getAdminTestOrgId(): string | null {
  // In browser environment, we can't access process.env directly
  // This should be configured through environment config or hardcoded for testing
  const envConfig = getEnvironmentConfig();
  return envConfig.testOrgId || null;
}

export function isAdminTestingEnabled(): boolean {
  return getAdminTestLevel() !== 'off';
}

export function isAdminTestSetupValid(): boolean {
  const testLevel = getAdminTestLevel();
  const testOrgId = getAdminTestOrgId();
  
  if (testLevel === 'off') return false;
  if (!testOrgId) return false;
  
  return true;
}

// Helper functions
export async function getCurrentAdminUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function createTestUser(): Promise<string | null> {
  try {
    const testEmail = `admin_test_${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    
    if (error) throw error;
    return data.user?.id || null;
  } catch (error) {
    console.error('Failed to create test user:', error);
    return null;
  }
}

export async function suspendTestOrg(orgId: string, reason: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('suspend_organization', {
      p_org_id: orgId,
      p_reason: reason
    });
    
    if (error) throw error;
    return (data as any)?.success || false;
  } catch (error) {
    console.error('Failed to suspend test org:', error);
    return false;
  }
}

export async function reinstateTestOrg(orgId: string, reason: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('reinstate_organization', {
      p_org_id: orgId,
      p_reason: reason
    });
    
    if (error) throw error;
    return (data as any)?.success || false;
  } catch (error) {
    console.error('Failed to reinstate test org:', error);
    return false;
  }
}

// Test scenarios

// 1. Access Control Tests
export async function testAdminAccessControl(orgId: string): Promise<AdminTestResult[]> {
  const results: AdminTestResult[] = [];
  const startTime = Date.now();
  
  try {
    // Test 1: Admin can access dashboard
    const adminUserId = await getCurrentAdminUserId();
    if (!adminUserId) {
      results.push({
        testName: 'admin_access_authenticated',
        status: 'fail',
        message: 'No authenticated user found',
        duration: Date.now() - startTime
      });
      return results;
    }
    
    const { data: hasAccess } = await supabase.rpc('check_admin_access', {
      p_org_id: orgId,
      p_user_id: adminUserId
    });
    
    results.push({
      testName: 'admin_access_control',
      status: hasAccess ? 'pass' : 'fail',
      message: hasAccess ? 'Admin has access' : 'Admin access denied',
      duration: Date.now() - startTime
    });
    
    // Test 2: Non-admin cannot access
    const testUserId = await createTestUser();
    if (testUserId) {
      const { data: nonAdminAccess } = await supabase.rpc('check_admin_access', {
        p_org_id: orgId,
        p_user_id: testUserId
      });
      
      results.push({
        testName: 'non_admin_access_denied',
        status: !nonAdminAccess ? 'pass' : 'fail',
        message: !nonAdminAccess ? 'Non-admin access properly denied' : 'Non-admin has unexpected access',
        duration: Date.now() - startTime
      });
    }
    
    return results;
  } catch (error) {
    results.push({
      testName: 'admin_access_control_error',
      status: 'fail',
      message: 'Access control test failed: ' + (error as Error).message,
      duration: Date.now() - startTime
    });
    return results;
  }
}

// 2. Suspend/Reinstate Tests
export async function testSuspendReinstate(orgId: string): Promise<AdminTestResult[]> {
  const results: AdminTestResult[] = [];
  const startTime = Date.now();
  
  try {
    // Test suspension
    const suspended = await suspendTestOrg(orgId, 'Automated test suspension');
    results.push({
      testName: 'organization_suspension',
      status: suspended ? 'pass' : 'fail',
      message: suspended ? 'Organization suspended successfully' : 'Suspension failed',
      duration: Date.now() - startTime
    });
    
    // Verify suspension status
    const { data: isSuspended } = await supabase.rpc('is_org_suspended', {
      org_id: orgId
    });
    
    results.push({
      testName: 'suspension_status_check',
      status: isSuspended ? 'pass' : 'fail',
      message: isSuspended ? 'Suspension status correctly set' : 'Suspension status not updated',
      duration: Date.now() - startTime
    });
    
    // Test reinstatement
    const reinstated = await reinstateTestOrg(orgId, 'Automated test reinstatement');
    results.push({
      testName: 'organization_reinstatement',
      status: reinstated ? 'pass' : 'fail',
      message: reinstated ? 'Organization reinstated successfully' : 'Reinstatement failed',
      duration: Date.now() - startTime
    });
    
    return results;
  } catch (error) {
    results.push({
      testName: 'suspend_reinstate_error',
      status: 'fail',
      message: 'Suspend/reinstate test failed: ' + (error as Error).message,
      duration: Date.now() - startTime
    });
    return results;
  }
}

// 3. Member Management Tests
export async function testMemberManagement(orgId: string): Promise<AdminTestResult[]> {
  const results: AdminTestResult[] = [];
  const startTime = Date.now();
  
  try {
    // Get current members
    const { data: members, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId)
      .limit(1);
    
    if (error) throw error;
    
    if (members && members.length > 0) {
      const testMember = members[0];
      
      // Test role change
      const { data: roleChangeResult } = await supabase.rpc('admin_change_member_role', {
        p_organization_id: orgId,
        p_user_id: testMember.user_id,
        p_new_role: 'viewer'
      });
      
      results.push({
        testName: 'member_role_change',
        status: (roleChangeResult as any)?.success ? 'pass' : 'fail',
        message: (roleChangeResult as any)?.success ? 'Role change successful' : 'Role change failed',
        duration: Date.now() - startTime
      });
      
      // Test seat deactivation
      const { data: seatToggleResult } = await supabase.rpc('admin_toggle_member_seat', {
        p_organization_id: orgId,
        p_user_id: testMember.user_id,
        p_seat_active: false
      });
      
      results.push({
        testName: 'member_seat_deactivation',
        status: (seatToggleResult as any)?.success ? 'pass' : 'fail',
        message: (seatToggleResult as any)?.success ? 'Seat deactivation successful' : 'Seat deactivation failed',
        duration: Date.now() - startTime
      });
      
      // Reactivate seat for cleanup
      await supabase.rpc('admin_toggle_member_seat', {
        p_organization_id: orgId,
        p_user_id: testMember.user_id,
        p_seat_active: true
      });
    } else {
      results.push({
        testName: 'member_management_skip',
        status: 'skip',
        message: 'No members found to test with',
        duration: Date.now() - startTime
      });
    }
    
    return results;
  } catch (error) {
    results.push({
      testName: 'member_management_error',
      status: 'fail',
      message: 'Member management test failed: ' + (error as Error).message,
      duration: Date.now() - startTime
    });
    return results;
  }
}

// 4. Audit Logging Tests
export async function testAuditLogging(orgId: string): Promise<AdminTestResult[]> {
  const results: AdminTestResult[] = [];
  const startTime = Date.now();
  
  try {
    // Count audit logs before action
    const { count: beforeCount } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    
    // Perform a test action that should create an audit log
    await supabase.rpc('log_activity_event', {
      p_org_id: orgId,
      p_action: 'test.audit_logging',
      p_target_type: 'test',
      p_metadata: { test_session: getCurrentAdminSessionId() }
    });
    
    // Wait a moment for the log to be written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Count audit logs after action
    const { count: afterCount } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    
    const logCreated = (afterCount || 0) > (beforeCount || 0);
    
    results.push({
      testName: 'audit_log_creation',
      status: logCreated ? 'pass' : 'fail',
      message: logCreated ? 'Audit log created successfully' : 'Audit log not created',
      details: { beforeCount, afterCount },
      duration: Date.now() - startTime
    });
    
    return results;
  } catch (error) {
    results.push({
      testName: 'audit_logging_error',
      status: 'fail',
      message: 'Audit logging test failed: ' + (error as Error).message,
      duration: Date.now() - startTime
    });
    return results;
  }
}

// 5. Smoke Tests (for production)
export async function runAdminSmokeTests(orgId?: string): Promise<AdminTestSuite> {
  const testOrgId = orgId || getAdminTestOrgId();
  const results: AdminTestResult[] = [];
  
  if (!testOrgId) {
    return {
      suiteName: 'Admin Smoke Tests',
      results: [{
        testName: 'setup_validation',
        status: 'fail',
        message: 'No test organization ID configured'
      }],
      totalTests: 1,
      passed: 0,
      failed: 1,
      skipped: 0
    };
  }
  
  // Only run access control in smoke tests
  const accessResults = await testAdminAccessControl(testOrgId);
  results.push(...accessResults);
  
  // Log all results
  for (const result of results) {
    await logAdminTestOutcome(
      result.testName,
      result.status,
      result.message,
      result.details,
      result.duration
    );
  }
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  return {
    suiteName: 'Admin Smoke Tests',
    results,
    totalTests: results.length,
    passed,
    failed,
    skipped
  };
}

// 6. Full Test Suite
export async function runAdminFullTests(orgId?: string): Promise<AdminTestSuite> {
  const testOrgId = orgId || getAdminTestOrgId();
  const results: AdminTestResult[] = [];
  
  if (!testOrgId) {
    return {
      suiteName: 'Admin Full Tests',
      results: [{
        testName: 'setup_validation',
        status: 'fail',
        message: 'No test organization ID configured'
      }],
      totalTests: 1,
      passed: 0,
      failed: 1,
      skipped: 0
    };
  }
  
  // Run all test scenarios
  const accessResults = await testAdminAccessControl(testOrgId);
  results.push(...accessResults);
  
  const suspendResults = await testSuspendReinstate(testOrgId);
  results.push(...suspendResults);
  
  const memberResults = await testMemberManagement(testOrgId);
  results.push(...memberResults);
  
  const auditResults = await testAuditLogging(testOrgId);
  results.push(...auditResults);
  
  // Log all results
  for (const result of results) {
    await logAdminTestOutcome(
      result.testName,
      result.status,
      result.message,
      result.details,
      result.duration
    );
  }
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  return {
    suiteName: 'Admin Full Tests',
    results,
    totalTests: results.length,
    passed,
    failed,
    skipped
  };
}

// Main test runner
export async function runAllAdminTests(orgId?: string): Promise<AdminTestSuite> {
  if (!isAdminTestingEnabled()) {
    return {
      suiteName: 'Admin Tests (Disabled)',
      results: [{
        testName: 'testing_disabled',
        status: 'skip',
        message: 'Admin testing is disabled'
      }],
      totalTests: 1,
      passed: 0,
      failed: 0,
      skipped: 1
    };
  }
  
  if (!isAdminTestSetupValid()) {
    return {
      suiteName: 'Admin Tests (Invalid Setup)',
      results: [{
        testName: 'invalid_setup',
        status: 'fail',
        message: 'Admin test setup is invalid - check TEST_ORG_ID configuration'
      }],
      totalTests: 1,
      passed: 0,
      failed: 1,
      skipped: 0
    };
  }
  
  const testLevel = getAdminTestLevel();
  generateAdminTestSessionId();
  
  if (testLevel === 'smoke') {
    return await runAdminSmokeTests(orgId);
  } else {
    return await runAdminFullTests(orgId);
  }
}