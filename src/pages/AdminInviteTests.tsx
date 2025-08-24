import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { InviteSystemTests } from '@/components/InviteSystemTests';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { getTestLevel, isTestingEnabled, isTestSetupValid } from '@/lib/invite-tests';

const AdminInviteTests = () => {
  const { user } = useAuth();
  const { organization } = useUserOrganization();
  const { role, loading: roleLoading } = useOrganizationRole(organization?.id);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string>('');

  useEffect(() => {
    const checkAccess = () => {
      const testLevel = getTestLevel();
      
      // Completely block access when testing is off (production default)
      if (testLevel === 'off') {
        setHasAccess(false);
        setAccessDeniedReason('Testing is disabled in production. Set RUN_TEST_LEVEL=smoke for read-only diagnostics.');
        setLoading(false);
        return;
      }
      
      // Check if testing is enabled and properly configured
      const testingEnabled = isTestingEnabled();
      const testSetup = isTestSetupValid();
      
      // Only allow access if:
      // 1. User is authenticated
      // 2. Testing is enabled and properly configured
      // 3. User is organization owner (admin role)
      // 4. Not in demo sandbox (has real organization)
      const isOwner = role === 'admin';
      const hasOrganization = organization && organization.id !== 'demo-org-id';
      
      if (!user) {
        setAccessDeniedReason('Authentication required');
      } else if (!testingEnabled || !testSetup.valid) {
        setAccessDeniedReason(testSetup.message || 'Testing configuration invalid');
      } else if (!isOwner) {
        setAccessDeniedReason('Organization owner privileges required');
      } else if (!hasOrganization) {
        setAccessDeniedReason('Valid organization required');
      } else {
        setHasAccess(true);
      }
      
      setLoading(false);
    };

    if (!roleLoading) {
      checkAccess();
    }
  }, [user, role, organization, roleLoading]);

  if (loading || roleLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!hasAccess) {
    // Return 403-like error page instead of redirect for better UX
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-6 max-w-md">
          <ShieldX className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            {accessDeniedReason}
          </p>
          <Alert className="mt-4 text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Current Configuration:</strong>
              <br />
              Test Level: <code className="bg-muted px-1 rounded">{getTestLevel()}</code>
              <br />
              Setup Valid: <code className="bg-muted px-1 rounded">{isTestSetupValid().valid ? 'Yes' : 'No'}</code>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 flex items-center border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Invite System Tests</h1>
          <Badge variant="secondary" className="text-xs">
            Dev Only
          </Badge>
          {getTestLevel() === 'smoke' && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 bg-amber-50">
              Read-Only Smoke
            </Badge>
          )}
        </div>
      </header>
      
      {getTestLevel() === 'smoke' && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mx-4 md:mx-6 mt-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">
                Non-customer internal diagnostics
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                This is a read-only diagnostic tool. <strong>Do not run on live organizations.</strong> 
                Only use for internal validation of system health.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-4 md:p-6">
        {/* Don't pass organizationId - tests will use configured TEST_ORG_ID */}
        <InviteSystemTests />
      </div>
    </div>
  );
};

export default AdminInviteTests;