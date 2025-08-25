import { getTestLevel } from "@/lib/invite-tests";

export function getEnvironmentConfig() {
  const testLevel = getTestLevel();
  
  return {
    testLevel,
    isTestingEnabled: testLevel !== 'off',
    showInternalChannels: testLevel !== 'off',
    showTestChannels: testLevel !== 'off',
    isProduction: testLevel === 'off',
    // For admin testing - in a real app this would come from environment variables
    // For now, return null to disable admin testing that requires a specific org ID
    testOrgId: null as string | null
  };
}

export function shouldShowChannel(channel: string, isOwner: boolean, isSuperAdmin?: boolean): boolean {
  const config = getEnvironmentConfig();
  
  switch (channel) {
    case 'audit':
      return true; // Always visible to all org members
      
    case 'internal':
      // Only visible to owners/admins when testing is enabled
      return (isOwner || isSuperAdmin) && config.showInternalChannels;
      
    case 'test_invites':
      // Only visible to owners/admins when testing is enabled
      return (isOwner || isSuperAdmin) && config.showTestChannels;
      
    default:
      return true;
  }
}

export function shouldExcludeFromCustomerView(channel: string): boolean {
  return ['internal', 'test_invites'].includes(channel);
}

export function shouldExcludeFromAnalytics(channel: string): boolean {
  return ['test_invites'].includes(channel);
}

export function shouldExcludeFromEmails(channel: string): boolean {
  return ['test_invites'].includes(channel);
}