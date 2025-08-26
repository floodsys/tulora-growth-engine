import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'editor' | 'viewer' | 'user';

interface UserRoleInfo {
  role: UserRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  isUser: boolean;
  isMember: boolean;
  seatActive: boolean;
  loading: boolean;
}

/**
 * Canonical user role hook that uses the database helper functions
 * Replaces legacy useUserRole and useOrganizationRole hooks
 */
export function useCanonicalUserRole(organizationId?: string): UserRoleInfo {
  const { user } = useAuth();
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo>({
    role: null,
    isOwner: false,
    isAdmin: false,
    isEditor: false,
    isViewer: false,
    isUser: false,
    isMember: false,
    seatActive: false,
    loading: true,
  });

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user || !organizationId) {
        setRoleInfo(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        // Use canonical helper function for role retrieval
        const { data, error } = await supabase.rpc('get_user_org_role', {
          p_org_id: organizationId,
          p_user_id: user.id
        });

        if (error) {
          console.error('Error fetching user role:', error);
          setRoleInfo(prev => ({ ...prev, loading: false }));
          return;
        }

        const roleData = data as any;
        const role = roleData?.role as UserRole | null;

        setRoleInfo({
          role,
          isOwner: roleData?.is_owner || false,
          isAdmin: role === 'admin',
          isEditor: role === 'editor',
          isViewer: role === 'viewer',
          isUser: role === 'user',
          isMember: roleData?.is_member || false,
          seatActive: roleData?.seat_active || false,
          loading: false,
        });
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setRoleInfo(prev => ({ ...prev, loading: false }));
      }
    };

    fetchUserRole();
  }, [user, organizationId]);

  return roleInfo;
}