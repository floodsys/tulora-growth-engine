import { useState, useEffect } from 'react';
import { SuspensionBanner } from '@/components/ui/SuspensionBanner';
import { useSuspensionCheck } from '@/hooks/useSuspensionCheck';
import { useAuth } from '@/contexts/AuthContext';

// Example of how to integrate suspension checks into a main dashboard component
export function DashboardWithSuspensionCheck() {
  const { user } = useAuth();
  const {
    organization,
    userRole,
    isLoading,
    isSuspended,
    isOwnerOrAdmin,
    permissions,
    refreshStatus
  } = useSuspensionCheck();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Suspension Banner */}
      {organization && (
        <SuspensionBanner
          suspensionStatus={organization.suspension_status}
          suspensionReason={organization.suspension_reason}
          suspendedAt={organization.suspended_at}
          canceledAt={organization.canceled_at}
          isOwnerOrAdmin={isOwnerOrAdmin}
        />
      )}

      <div className="container mx-auto px-6 py-6">
        {/* Main content - conditionally render based on permissions */}
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          
          {/* Agents Section - disabled if suspended */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className={`p-6 border rounded-lg ${!permissions.canCreateAgents ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="text-lg font-semibold mb-2">AI Agents</h3>
              <p className="text-muted-foreground mb-4">
                Manage your AI agents and configurations
              </p>
              <button
                disabled={!permissions.canCreateAgents}
                className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
              >
                Create Agent
              </button>
              {!permissions.canCreateAgents && (
                <p className="text-xs text-red-600 mt-2">
                  Agent creation is disabled due to suspension
                </p>
              )}
            </div>

            {/* Calls Section - disabled if suspended */}
            <div className={`p-6 border rounded-lg ${!permissions.canMakeCalls ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="text-lg font-semibold mb-2">Make Calls</h3>
              <p className="text-muted-foreground mb-4">
                Initiate outbound calls with your agents
              </p>
              <button
                disabled={!permissions.canMakeCalls}
                className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
              >
                Start Call
              </button>
              {!permissions.canMakeCalls && (
                <p className="text-xs text-red-600 mt-2">
                  Calling is disabled due to suspension
                </p>
              )}
            </div>

            {/* Team Management - invites disabled if suspended */}
            <div className={`p-6 border rounded-lg ${!permissions.canCreateInvites ? 'opacity-50' : ''}`}>
              <h3 className="text-lg font-semibold mb-2">Team Management</h3>
              <p className="text-muted-foreground mb-4">
                Manage team members and permissions
              </p>
              <button
                disabled={!permissions.canCreateInvites}
                className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
              >
                Invite Member
              </button>
              {!permissions.canCreateInvites && (
                <p className="text-xs text-red-600 mt-2">
                  Invitations are disabled due to suspension
                </p>
              )}
            </div>
          </div>

          {/* Settings and Billing - always accessible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Settings</h3>
              <p className="text-muted-foreground mb-4">
                Configure your organization settings
              </p>
              <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded">
                Open Settings
              </button>
            </div>

            <div className="p-6 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Billing</h3>
              <p className="text-muted-foreground mb-4">
                Manage your subscription and usage
              </p>
              <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded">
                View Billing
              </button>
            </div>
          </div>

          {/* Debug Info (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Suspension Debug Info</h4>
              <pre className="text-xs">
                {JSON.stringify({
                  isSuspended,
                  isOwnerOrAdmin,
                  permissions,
                  organizationStatus: organization?.suspension_status,
                  userRole: userRole?.role
                }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}