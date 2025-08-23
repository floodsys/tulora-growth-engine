import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'owner' | 'admin' | 'member' | null;

export const useUserRole = (orgId?: string) => {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user || !orgId) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('memberships')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole(null);
        } else {
          setRole(data?.role as UserRole);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [user, orgId]);

  const isOwner = role === 'owner';
  const isAdmin = role === 'admin' || role === 'owner';
  const isMember = role === 'member' || role === 'admin' || role === 'owner';

  return {
    role,
    isOwner,
    isAdmin,
    isMember,
    isLoading
  };
};