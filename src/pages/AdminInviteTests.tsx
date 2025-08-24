import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { InviteSystemTests } from '@/components/InviteSystemTests';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';

const AdminInviteTests = () => {
  const { user } = useAuth();
  const { organization } = useUserOrganization();
  const { role, loading: roleLoading } = useOrganizationRole(organization?.id);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = () => {
      // Check if RUN_TEST_LEVEL is not "off" (environment variable check)
      const testLevel = import.meta.env.VITE_RUN_TEST_LEVEL || 'off';
      
      // Only allow access if:
      // 1. User is authenticated
      // 2. RUN_TEST_LEVEL is not "off"
      // 3. User is organization owner (admin role)
      // 4. Not in demo sandbox (has real organization)
      const isTestingEnabled = testLevel !== 'off';
      const isOwner = role === 'admin';
      const hasOrganization = organization && organization.id !== 'demo-org-id';
      
      const access = user && isTestingEnabled && isOwner && hasOrganization;
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
    return <Navigate to="/dashboard" replace />;
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
        <InviteSystemTests organizationId={organization?.id} />
      </div>
    </div>
  );
};

export default AdminInviteTests;