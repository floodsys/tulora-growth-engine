import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
  owner_user_id: string | null;
  created_at: string;
}

export function useUserOrganization() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserOrganization = async () => {
      if (!user) {
        setOrganization(null);
        setLoading(false);
        return;
      }

      try {
        // First check if user owns an organization
        const { data: ownedOrg } = await supabase
          .from('organizations')
          .select('*')
          .eq('owner_user_id', user.id)
          .single();

        if (ownedOrg) {
          setOrganization(ownedOrg);
        } else {
          // Check if user is a member of an organization
          const { data: membership } = await supabase
            .from('organization_members')
            .select(`
              organization_id,
              organizations!inner (
                id,
                name,
                owner_user_id,
                created_at
              )
            `)
            .eq('user_id', user.id)
            .eq('seat_active', true)
            .limit(1)
            .single();

          if (membership?.organizations && !Array.isArray(membership.organizations)) {
            setOrganization(membership.organizations as unknown as Organization);
          }
        }
      } catch (error) {
        console.error('Error fetching user organization:', error);
        setOrganization(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserOrganization();
  }, [user]);

  return {
    organization,
    loading,
    organizationId: organization?.id || null,
    isOwner: organization?.owner_user_id === user?.id,
  };
}