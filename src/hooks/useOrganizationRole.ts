import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type OrganizationRole = 'admin' | 'editor' | 'viewer' | 'user';

export function useOrganizationRole(organizationId?: string) {
  const { user } = useAuth();
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user || !organizationId) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // Use canonical helper functions instead of direct table queries
        
        // First check if user is organization owner via canonical helper
        const { data: isOwner, error: ownerError } = await supabase.rpc('check_org_ownership', {
          p_org_id: organizationId,
          p_user_id: user.id
        });

        if (ownerError) {
          console.error('Error checking ownership:', ownerError);
          setRole(null);
          setLoading(false);
          return;
        }

        if (isOwner) {
          setRole('admin');
          setLoading(false);
          return;
        }

        // Check organization membership via canonical helper
        const { data: isMember, error: memberError } = await supabase.rpc('check_org_membership', {
          p_org_id: organizationId,
          p_user_id: user.id
        });

        if (memberError) {
          console.error('Error checking membership:', memberError);
          setRole(null);
          setLoading(false);
          return;
        }

        if (!isMember) {
          setRole(null);
          setLoading(false);
          return;
        }

        // Get specific role from organization_members if they are a member
        const { data: memberData, error: roleError } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .eq('seat_active', true)
          .single();

        if (roleError || !memberData) {
          setRole(null);
        } else {
          setRole(memberData.role as OrganizationRole);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user, organizationId]);

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isViewer = role === 'viewer';
  const isUser = role === 'user';

  return {
    role,
    loading,
    isAdmin,
    isEditor,
    isViewer,
    isUser,
  };
}