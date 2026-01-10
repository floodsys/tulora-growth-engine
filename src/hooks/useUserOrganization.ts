import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

interface Organization {
  id: string;
  name: string;
  owner_user_id: string | null;
  created_at: string;
}

/**
 * Canonical hook for getting the user's current organization.
 * 
 * The organizationId is derived from profile.current_org_id as the single source of truth.
 * If current_org_id is null, the user is treated as not fully onboarded.
 * 
 * This hook fetches the full organization object for the current_org_id.
 */
export function useUserOrganization() {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive organizationId from profile.current_org_id (canonical source)
  const currentOrgId = profile?.current_org_id ?? null;

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!user) {
        setOrganization(null);
        setLoading(false);
        return;
      }

      // Wait for profile to load
      if (profileLoading) {
        return;
      }

      // If no current_org_id, user is not fully onboarded
      if (!currentOrgId) {
        setOrganization(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch the organization for the current_org_id
        const { data: org, error } = await supabase
          .from('organizations')
          .select('id, name, owner_user_id, created_at')
          .eq('id', currentOrgId)
          .single();

        if (error) {
          console.error('Error fetching organization:', error);
          setOrganization(null);
        } else {
          setOrganization(org);
        }
      } catch (error) {
        console.error('Error fetching user organization:', error);
        setOrganization(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [user, currentOrgId, profileLoading]);

  return {
    organization,
    loading: loading || profileLoading,
    organizationId: currentOrgId,
    isOwner: organization?.owner_user_id === user?.id,
  };
}
