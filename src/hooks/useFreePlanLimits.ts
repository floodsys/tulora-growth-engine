import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useUserOrganization';

interface FreePlanLimits {
  canCreateOrganization: boolean;
  canAddTeamMember: boolean;
  organizationCount: number;
  teamMemberCount: number;
  isNonPaying: boolean;
  hasPendingBilling: boolean;
  loading: boolean;
}

const NON_PAYING_STATUSES = ['trialing', 'pending_billing', null, undefined];
const FREE_PLAN_KEYS = ['trial', 'free', null, undefined];

export function useFreePlanLimits(): FreePlanLimits {
  const { organizationId, organization, loading: orgLoading } = useUserOrganization();
  const [limits, setLimits] = useState<FreePlanLimits>({
    canCreateOrganization: true,
    canAddTeamMember: true,
    organizationCount: 0,
    teamMemberCount: 0,
    isNonPaying: true,
    hasPendingBilling: false,
    loading: true,
  });

  useEffect(() => {
    async function checkLimits() {
      if (orgLoading || !organizationId) {
        setLimits(prev => ({ ...prev, loading: true }));
        return;
      }

      try {
        // Get current organization details
        const { data: currentOrg } = await supabase
          .from('organizations')
          .select('billing_status, plan_key')
          .eq('id', organizationId)
          .single();

        if (!currentOrg) {
          setLimits(prev => ({ ...prev, loading: false }));
          return;
        }

        const isNonPaying = NON_PAYING_STATUSES.includes(currentOrg.billing_status) || 
                           FREE_PLAN_KEYS.includes(currentOrg.plan_key);
        const hasPendingBilling = currentOrg.billing_status === 'pending_billing';

        if (!isNonPaying) {
          // Paid organization - no limits
          setLimits({
            canCreateOrganization: true,
            canAddTeamMember: true,
            organizationCount: 0,
            teamMemberCount: 0,
            isNonPaying: false,
            hasPendingBilling: false,
            loading: false,
          });
          return;
        }

        // Check organization count for this user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLimits(prev => ({ ...prev, loading: false }));
          return;
        }

        const { data: userOrgs } = await supabase
          .from('organizations')
          .select('id, billing_status, plan_key')
          .eq('owner_user_id', user.id);

        const nonPayingOrgCount = userOrgs?.filter(org => 
          NON_PAYING_STATUSES.includes(org.billing_status) || 
          FREE_PLAN_KEYS.includes(org.plan_key)
        ).length || 0;

        // Check team member count in current organization
        const { data: teamMembers } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('seat_active', true);

        const teamMemberCount = teamMembers?.length || 0;

        setLimits({
          canCreateOrganization: nonPayingOrgCount < 1,
          canAddTeamMember: teamMemberCount < 1,
          organizationCount: nonPayingOrgCount,
          teamMemberCount,
          isNonPaying,
          hasPendingBilling,
          loading: false,
        });

      } catch (error) {
        console.error('Error checking free plan limits:', error);
        setLimits(prev => ({ ...prev, loading: false }));
      }
    }

    checkLimits();
  }, [organizationId, orgLoading]);

  return limits;
}