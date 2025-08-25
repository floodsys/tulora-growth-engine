import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useUserOrganization';

interface OwnerInfo {
  isCurrentUserOwner: boolean;
  organizationOwnerId: string | null;
  loading: boolean;
}

export function useOwnerInfo(): OwnerInfo {
  const { organization, loading: orgLoading } = useUserOrganization();
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo>({
    isCurrentUserOwner: false,
    organizationOwnerId: null,
    loading: true,
  });

  useEffect(() => {
    async function checkOwnerInfo() {
      if (orgLoading || !organization) {
        setOwnerInfo(prev => ({ ...prev, loading: true }));
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        setOwnerInfo({
          isCurrentUserOwner: user?.id === organization.owner_user_id,
          organizationOwnerId: organization.owner_user_id || null,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking owner info:', error);
        setOwnerInfo({
          isCurrentUserOwner: false,
          organizationOwnerId: null,
          loading: false,
        });
      }
    }

    checkOwnerInfo();
  }, [organization, orgLoading]);

  return ownerInfo;
}