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
        // Check if user is organization owner first
        const { data: orgData } = await supabase
          .from('organizations')
          .select('owner_user_id')
          .eq('id', organizationId)
          .single();

        if (orgData?.owner_user_id === user.id) {
          setRole('admin');
          setLoading(false);
          return;
        }

        // Check organization_members table
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .single();

        if (memberData) {
          setRole(memberData.role as OrganizationRole);
        } else {
          setRole(null);
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