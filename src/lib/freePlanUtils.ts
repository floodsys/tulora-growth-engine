import { supabase } from '@/integrations/supabase/client';

export interface FreePlanCheckResult {
  allowed: boolean;
  error?: string;
  errorCode?: string;
  currentCount?: number;
  limit?: number;
}

export async function checkFreePlanLimits(
  action: 'create_organization' | 'add_team_member',
  organizationId?: string
): Promise<FreePlanCheckResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-free-plan-limits', {
      body: {
        action,
        organizationId
      }
    });

    if (error) {
      // If it's a 402 error, it means limits were exceeded
      if (error.status === 402) {
        return {
          allowed: false,
          error: error.message || 'Free plan limit exceeded',
          errorCode: 'UPGRADE_REQUIRED',
          currentCount: error.currentCount,
          limit: error.limit
        };
      }
      
      // Other errors
      return {
        allowed: false,
        error: error.message || 'Failed to check limits'
      };
    }

    return data || { allowed: true };
  } catch (error) {
    console.error('Error checking free plan limits:', error);
    return {
      allowed: false,
      error: 'Failed to check free plan limits'
    };
  }
}

export async function createOrganizationWithLimits(name: string, slug?: string) {
  try {
    const { data, error } = await supabase.functions.invoke('create-organization-with-limits', {
      body: {
        name,
        slug
      }
    });

    if (error) {
      // If it's a 402 error, it means limits were exceeded
      if (error.status === 402) {
        throw new Error('UPGRADE_REQUIRED');
      }
      
      throw new Error(error.message || 'Failed to create organization');
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.message === 'UPGRADE_REQUIRED') {
      throw error;
    }
    
    console.error('Error creating organization:', error);
    throw new Error('Failed to create organization');
  }
}

export async function createInviteWithLimits(organizationId: string, email: string, role: string) {
  try {
    const { data, error } = await supabase.functions.invoke('create-invite-with-limits', {
      body: {
        p_org: organizationId,
        p_email: email,
        p_role: role
      }
    });

    if (error) {
      // If it's a 402 error, it means limits were exceeded
      if (error.status === 402) {
        throw new Error('UPGRADE_REQUIRED');
      }
      
      throw new Error(error.message || 'Failed to create invitation');
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.message === 'UPGRADE_REQUIRED') {
      throw error;
    }
    
    console.error('Error creating invitation:', error);
    throw new Error('Failed to create invitation');
  }
}
