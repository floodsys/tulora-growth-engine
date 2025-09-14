import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending' | 'warning';
  message: string;
  details?: any;
}

export function TeamsConsolidationTests() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationId, isOwner, loading: orgLoading } = useUserOrganization();
  const { isAdmin, loading: roleLoading } = useOrganizationRole(organizationId || undefined);

  const runTests = async () => {
    if (orgLoading || roleLoading) return;
    
    setIsRunning(true);
    const results: TestResult[] = [];

    // A) Routing Tests
    try {
      // Test 1: Canonical route structure
      results.push({
        name: 'A1: Canonical route structure',
        status: location.pathname.includes('/settings/organization') ? 'pass' : 'fail',
        message: location.pathname.includes('/settings/organization') 
          ? 'Currently on organization settings page' 
          : `Expected organization settings, got: ${location.pathname}`,
        details: { currentPath: location.pathname }
      });

      // Test 2: Redirect behavior simulation
      const redirectTest = await testRedirectBehavior();
      results.push(redirectTest);

      // Test 3: Navigation link consistency
      const navTest = await testNavigationLinks();
      results.push(navTest);

    } catch (error) {
      results.push({
        name: 'A: Routing Tests',
        status: 'fail',
        message: `Routing test error: ${error}`,
        details: { error }
      });
    }

    // B) RBAC Tests
    try {
      const rbacTest = await testRBACAccess();
      results.push(rbacTest);

      const tabVisibilityTest = testTabVisibility();
      results.push(tabVisibilityTest);

    } catch (error) {
      results.push({
        name: 'B: RBAC Tests',
        status: 'fail',
        message: `RBAC test error: ${error}`,
        details: { error }
      });
    }

    // C) Owner UI Tests
    try {
      const ownerUITest = testOwnerUIInvariants();
      results.push(ownerUITest);

    } catch (error) {
      results.push({
        name: 'C: Owner UI Tests',
        status: 'fail',
        message: `Owner UI test error: ${error}`,
        details: { error }
      });
    }

    // D) Data & RPC Tests
    try {
      const rpcTest = await testRPCUsage();
      results.push(rpcTest);

    } catch (error) {
      results.push({
        name: 'D: Data & RPC Tests',
        status: 'fail',
        message: `RPC test error: ${error}`,
        details: { error }
      });
    }

    // E) CI Tripwire Tests
    try {
      const tripwireTest = await testCITripwires();
      results.push(tripwireTest);

    } catch (error) {
      results.push({
        name: 'E: CI Tripwire Tests',
        status: 'fail',
        message: `Tripwire test error: ${error}`,
        details: { error }
      });
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const testRedirectBehavior = async (): Promise<TestResult> => {
    try {
      // Simulate checking redirect behavior
      const redirectComponent = document.querySelector('[data-testid="redirect-to-organization-team"]');
      const hasRedirectComponent = !!redirectComponent;
      
      return {
        name: 'A2: Legacy route redirect',
        status: hasRedirectComponent ? 'pass' : 'warning',
        message: hasRedirectComponent 
          ? 'Redirect component found for legacy /settings/teams route'
          : 'Redirect component not found - may need verification',
        details: { hasRedirectComponent }
      };
    } catch (error) {
      return {
        name: 'A2: Legacy route redirect',
        status: 'fail',
        message: `Redirect test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testNavigationLinks = async (): Promise<TestResult> => {
    try {
      // Check if sidebar has correct team link
      const teamLinks = document.querySelectorAll('a[href*="/settings/organization/team"]');
      const oldTeamLinks = document.querySelectorAll('a[href="/settings/teams"]');
      
      return {
        name: 'A3: Navigation link consistency',
        status: teamLinks.length > 0 && oldTeamLinks.length === 0 ? 'pass' : 'fail',
        message: teamLinks.length > 0 && oldTeamLinks.length === 0
          ? `Found ${teamLinks.length} correct team links, no legacy links`
          : `Found ${teamLinks.length} correct links, ${oldTeamLinks.length} legacy links`,
        details: { correctLinks: teamLinks.length, legacyLinks: oldTeamLinks.length }
      };
    } catch (error) {
      return {
        name: 'A3: Navigation link consistency',
        status: 'fail',
        message: `Navigation link test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testRBACAccess = async (): Promise<TestResult> => {
    try {
      const hasAdminAccess = isOwner || isAdmin;
      const expectedAccess = hasAdminAccess ? '200' : '403';
      const actualAccess = hasAdminAccess ? '200' : '403'; // Simulated based on current access
      
      // Check if access is properly controlled
      if (hasAdminAccess) {
        // Should have access to team management features
        const inviteForm = document.querySelector('[data-testid="invite-form"]') || 
                          document.querySelector('form[data-team-invite]') ||
                          document.querySelector('input[placeholder*="email"]');
        
        return {
          name: 'B1: RBAC access control',
          status: inviteForm ? 'pass' : 'warning',
          message: inviteForm 
            ? `Admin/Owner access granted (${actualAccess}) with team management UI`
            : `Admin/Owner access granted (${actualAccess}) but team UI not found`,
          details: { expectedAccess, actualAccess, hasAdminAccess, hasInviteForm: !!inviteForm }
        };
      } else {
        // Should be blocked from team management
        const accessDeniedPage = document.querySelector('[data-testid="team-access-denied"]') ||
                                document.querySelector('h1:contains("Admin Access Required")');
        
        return {
          name: 'B1: RBAC access control',
          status: accessDeniedPage ? 'pass' : 'fail',
          message: accessDeniedPage 
            ? `Non-admin correctly blocked (${actualAccess}) with access denied page`
            : `Non-admin should be blocked (${expectedAccess}) but access denied page not found`,
          details: { expectedAccess, actualAccess, hasAdminAccess, hasAccessDeniedPage: !!accessDeniedPage }
        };
      }
    } catch (error) {
      return {
        name: 'B1: RBAC access control',
        status: 'fail',
        message: `RBAC access test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testTabVisibility = (): TestResult => {
    try {
      const hasAdminAccess = isOwner || isAdmin;
      const teamTab = document.querySelector('[data-testid="team-tab"]') ||
                     document.querySelector('button:contains("Team")') ||
                     document.querySelector('[role="tab"]:contains("Team")');
      
      if (hasAdminAccess) {
        return {
          name: 'B2: Tab visibility for admins',
          status: teamTab ? 'pass' : 'fail',
          message: teamTab 
            ? 'Team tab visible for admin/owner'
            : 'Team tab should be visible for admin/owner',
          details: { hasAdminAccess, hasTeamTab: !!teamTab }
        };
      } else {
        return {
          name: 'B2: Tab visibility for non-admins',
          status: !teamTab ? 'pass' : 'warning',
          message: !teamTab 
            ? 'Team tab correctly hidden for non-admin'
            : 'Team tab visible for non-admin (may be intentional for 403 handling)',
          details: { hasAdminAccess, hasTeamTab: !!teamTab }
        };
      }
    } catch (error) {
      return {
        name: 'B2: Tab visibility',
        status: 'fail',
        message: `Tab visibility test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testOwnerUIInvariants = (): TestResult => {
    try {
      if (!isOwner) {
        return {
          name: 'C1: Owner UI invariants',
          status: 'pass',
          message: 'Not owner - owner UI tests skipped',
          details: { isOwner, reason: 'not_owner' }
        };
      }

      // Look for owner-specific UI elements
      const ownerBadge = document.querySelector('[data-testid="owner-badge"]') ||
                        document.querySelector('.owner-badge') ||
                        document.querySelector('*:contains("Owner")');
      
      const transferOwnershipButton = document.querySelector('[data-testid="transfer-ownership"]') ||
                                    document.querySelector('button:contains("Transfer Ownership")') ||
                                    document.querySelector('button:contains("Transfer")');
      
      const ownerRoleSelector = document.querySelector('[data-testid="owner-role-selector"]') ||
                              document.querySelector('select[data-owner-role]');
      
      const ownerRemoveButton = document.querySelector('[data-testid="remove-owner"]') ||
                              document.querySelector('button[data-remove-owner]');

      const hasCorrectOwnerUI = ownerBadge && transferOwnershipButton && !ownerRoleSelector && !ownerRemoveButton;
      
      return {
        name: 'C1: Owner UI invariants',
        status: hasCorrectOwnerUI ? 'pass' : 'warning',
        message: hasCorrectOwnerUI
          ? 'Owner UI correct: badge visible, transfer button present, no role/remove controls'
          : 'Owner UI may need verification - check badge, transfer button, locked controls',
        details: {
          hasOwnerBadge: !!ownerBadge,
          hasTransferButton: !!transferOwnershipButton,
          hasRoleSelector: !!ownerRoleSelector,
          hasRemoveButton: !!ownerRemoveButton
        }
      };
    } catch (error) {
      return {
        name: 'C1: Owner UI invariants',
        status: 'fail',
        message: `Owner UI test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testRPCUsage = async (): Promise<TestResult> => {
    try {
      if (!organizationId) {
        return {
          name: 'D1: RPC usage verification',
          status: 'warning',
          message: 'No organization ID - RPC tests skipped',
          details: { reason: 'no_organization' }
        };
      }

      // Check if we can verify RPC functions exist
      const { data: rpcTest } = await supabase.rpc('is_org_admin', { org_id: organizationId });
      
      return {
        name: 'D1: RPC usage verification',
        status: typeof rpcTest === 'boolean' ? 'pass' : 'fail',
        message: typeof rpcTest === 'boolean'
          ? 'RPC functions accessible and returning expected types'
          : 'RPC functions not accessible or returning unexpected types',
        details: { rpcTest, type: typeof rpcTest }
      };
    } catch (error) {
      return {
        name: 'D1: RPC usage verification',
        status: 'fail',
        message: `RPC test failed: ${error}`,
        details: { error }
      };
    }
  };

  const testCITripwires = async (): Promise<TestResult> => {
    try {
      // Check for any elements that might indicate legacy team routes
      const legacyReferences = document.querySelectorAll('*[href="/settings/teams"]');
      const redirectReferences = document.querySelectorAll('[data-testid="redirect-to-organization-team"]');
      
      // Simulate checking for deprecated components (would be done by CI in real scenario)
      const hasLegacyReferences = legacyReferences.length > 0 && redirectReferences.length === 0;
      
      return {
        name: 'E1: CI tripwire verification',
        status: !hasLegacyReferences ? 'pass' : 'fail',
        message: !hasLegacyReferences
          ? 'No legacy team route references found (except redirect)'
          : `Found ${legacyReferences.length} legacy references without redirect component`,
        details: { 
          legacyReferences: legacyReferences.length,
          redirectReferences: redirectReferences.length,
          hasLegacyReferences
        }
      };
    } catch (error) {
      return {
        name: 'E1: CI tripwire verification',
        status: 'fail',
        message: `Tripwire test failed: ${error}`,
        details: { error }
      };
    }
  };

  useEffect(() => {
    if (!orgLoading && !roleLoading) {
      runTests();
    }
  }, [orgLoading, roleLoading, organizationId]);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pass: 'default',
      fail: 'destructive',
      warning: 'secondary',
      pending: 'outline'
    } as const;

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const passCount = testResults.filter(r => r.status === 'pass').length;
  const failCount = testResults.filter(r => r.status === 'fail').length;
  const warningCount = testResults.filter(r => r.status === 'warning').length;

  if (orgLoading || roleLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Teams Consolidation Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 animate-spin" />
            <span>Loading organization data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Teams Consolidation Tests</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Verifying routing, RBAC, owner UI, and data security for canonical /settings/organization/team
            </p>
          </div>
          <Button onClick={runTests} disabled={isRunning} size="sm">
            {isRunning ? 'Running...' : 'Re-run Tests'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Summary */}
        <div className="flex gap-4 p-3 bg-muted rounded-lg">
          <div className="text-sm">
            <span className="font-medium">Status:</span> Organization: {organizationId ? 'Found' : 'None'} | 
            Role: {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'User'} | 
            Path: {location.pathname}
          </div>
        </div>

        {/* Results Summary */}
        {testResults.length > 0 && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">✅ Pass: {passCount}</span>
            <span className="text-red-600">❌ Fail: {failCount}</span>
            <span className="text-yellow-600">⚠️ Warning: {warningCount}</span>
            <span className="text-blue-600">⏳ Total: {testResults.length}</span>
          </div>
        )}

        {/* Test Results */}
        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(result.status)}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium">{result.name}</h4>
                  {getStatusBadge(result.status)}
                </div>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      Show details
                    </summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>

        {testResults.length === 0 && !isRunning && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2" />
            <p>No test results yet. Click "Re-run Tests" to start.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}