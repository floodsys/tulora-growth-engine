import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { InviteSystemTests } from '@/components/InviteSystemTests';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX } from 'lucide-react';
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

  useEffect(() => {
    const checkAccess = () => {
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
      
      const access = user && testingEnabled && testSetup.valid && isOwner && hasOrganization;
      setHasAccess(!!access);
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
        <div className="text-center space-y-4 p-6">
          <ShieldX className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">
            This admin testing interface is only available when testing is enabled and you are an organization owner.
          </p>
          <Alert className="mt-4">
            <AlertDescription>
              Current test level: <code className="bg-muted px-1 rounded">{getTestLevel()}</code>
              <br />
              Test setup: <code className="bg-muted px-1 rounded">{isTestSetupValid().valid ? 'Valid' : 'Invalid'}</code>
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
        </div>
      </header>
      
      <div className="p-4 md:p-6">
        {/* Don't pass organizationId - tests will use configured TEST_ORG_ID */}
        <InviteSystemTests />
      </div>
    </div>
  );
};

export default AdminInviteTests;