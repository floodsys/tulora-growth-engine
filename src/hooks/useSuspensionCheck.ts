import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
  suspension_status?: string;
  suspension_reason?: string;
  suspended_at?: string;
  suspended_by?: string;
  canceled_at?: string;
}

interface OrganizationRole {
  role: string;
  seat_active: boolean;
}

export function useSuspensionCheck() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<OrganizationRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    checkSuspensionStatus();
  }, [user]);

  const checkSuspensionStatus = async () => {
    try {
      // Get user's organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          suspension_status,
          suspension_reason,
          suspended_at,
          suspended_by,
          canceled_at,
          owner_user_id
        `)
        .eq('owner_user_id', user?.id)
        .single();

      if (orgError && orgError.code !== 'PGRST116') {
        // Try to find organization through membership
        const { data: memberData, error: memberError } = await supabase
          .from('organization_members')
          .select(`
            role,
            seat_active,
            organization_id
          `)
          .eq('user_id', user?.id)
          .eq('seat_active', true)
          .single();

        if (memberError) {
          console.error('Error fetching organization:', memberError);
          return;
        }

        // Get organization details separately
        const { data: orgDetails, error: orgDetailsError } = await supabase
          .from('organizations')
          .select(`
            id,
            name,
            suspension_status,
            suspension_reason,
            suspended_at,
            suspended_by,
            canceled_at
          `)
          .eq('id', memberData.organization_id)
          .single();

        if (orgDetailsError) {
          console.error('Error fetching organization details:', orgDetailsError);
          return;
        }

        setOrganization(orgDetails);
        setUserRole({
          role: memberData.role,
          seat_active: memberData.seat_active
        });
      } else if (orgData) {
        setOrganization(orgData);
        setUserRole({
          role: 'admin', // Owner is always admin
          seat_active: true
        });
      }
    } catch (error) {
      console.error('Error checking suspension status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isSuspended = organization?.suspension_status === 'suspended';
  const isCanceled = organization?.suspension_status === 'canceled';
  const isBlocked = isSuspended || isCanceled;
  const isOwnerOrAdmin = userRole?.role === 'admin' || userRole?.role === 'owner';

  // Check if specific actions are allowed
  const canCreateAgents = !isBlocked;
  const canMakeCalls = !isBlocked;
  const canCreateInvites = !isBlocked;
  const canAccessAPI = !isBlocked;
  const canAccessWebhooks = !isBlocked;
  
  // Allow read-only access to settings and billing for suspended, but restrict for canceled
  const canAccessSettings = !isCanceled;
  const canAccessBilling = !isCanceled;

  return {
    organization,
    userRole,
    isLoading,
    isSuspended,
    isCanceled,
    isBlocked,
    isOwnerOrAdmin,
    permissions: {
      canCreateAgents,
      canMakeCalls,
      canCreateInvites,
      canAccessAPI,
      canAccessWebhooks,
      canAccessSettings,
      canAccessBilling
    },
    refreshStatus: checkSuspensionStatus
  };
}