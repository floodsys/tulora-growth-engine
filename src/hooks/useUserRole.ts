import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * @deprecated Use useCanonicalUserRole instead for canonical ownership/membership checks
 * This hook has been updated to use organization_members but consider migrating to useCanonicalUserRole
 */
export type UserRole = 'admin' | 'editor' | 'viewer' | 'user';

export function useUserRole(organizationId?: string) {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user || !organizationId) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        // Use canonical organization_members table instead of legacy memberships
        const { data, error } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .eq('seat_active', true) // Only active seats
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole(null);
        } else {
          setRole(data?.role as UserRole);
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user, organizationId]);

  const isOwner = role === 'admin';
  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isViewer = role === 'viewer';
  const isUser = role === 'user';

  return {
    role,
    loading,
    isOwner,
    isAdmin,
    isEditor,
    isViewer,
    isUser,
  };
}