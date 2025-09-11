import { useState, useEffect } from 'react';
import { ManualAccessBanner } from '@/components/ui/ManualAccessBanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ManualAccessBannerContainerProps {
  className?: string;
}

export function ManualAccessBannerContainer({ className }: ManualAccessBannerContainerProps) {
  const { user } = useAuth();
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        // Get user's current organization
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_org_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.current_org_id) {
          // Get organization with entitlements
          const { data: org } = await supabase
            .from('organizations')
            .select('id, name, plan_key, billing_status, entitlements')
            .eq('id', profile.current_org_id)
            .single();

          setOrganizationData(org);
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [user]);

  if (loading || !organizationData?.entitlements?.manual_activation) {
    return null;
  }

  return (
    <div className={className}>
      <ManualAccessBanner
        organizationId={organizationData.id}
        planKey={organizationData.plan_key}
        endsAt={organizationData.entitlements.manual_activation.ends_at}
        isActive={organizationData.entitlements.manual_activation.active}
      />
    </div>
  );
}