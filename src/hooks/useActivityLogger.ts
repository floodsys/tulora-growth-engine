import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useUserOrganization';

export type ActivityAction = 
  | 'organization_created'
  | 'organization_updated' 
  | 'organization_deleted'
  | 'member_invited'
  | 'member_removed'
  | 'member_role_updated'
  | 'invite_accepted'
  | 'invite_declined'
  | 'invite_revoked'
  | 'agent_created'
  | 'agent_updated'
  | 'agent_deleted'
  | 'agent_activated'
  | 'agent_deactivated'
  | 'call_initiated'
  | 'call_completed'
  | 'call_failed'
  | 'lead_created'
  | 'lead_updated'
  | 'lead_deleted'
  | 'appointment_scheduled'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'kb_file_uploaded'
  | 'kb_file_deleted'
  | 'settings_updated'
  | 'billing_updated'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'user_login'
  | 'user_logout'
  | 'password_changed'
  | 'profile_updated';

export type ResourceType = 
  | 'organization'
  | 'user'
  | 'member'
  | 'invitation'
  | 'agent'
  | 'call'
  | 'lead'
  | 'appointment'
  | 'kb_file'
  | 'settings'
  | 'subscription';

interface ActivityLogData {
  action: ActivityAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, any>;
}

export function useActivityLogger() {
  const { organizationId } = useUserOrganization();

  const logActivity = useCallback(async ({
    action,
    resourceType,
    resourceId,
    details = {}
  }: ActivityLogData) => {
    if (!organizationId) {
      console.warn('Cannot log activity: No organization context');
      return null;
    }

    try {
      // Get client info for enhanced logging
      const userAgent = navigator.userAgent;
      const timestamp = new Date().toISOString();
      
      // Enrich details with context
      const enrichedDetails = {
        ...details,
        timestamp,
        userAgent,
        url: window.location.pathname,
        ...(details.previousValue && { previousValue: details.previousValue }),
        ...(details.newValue && { newValue: details.newValue })
      };

      const { data, error } = await supabase.rpc('log_activity', {
        p_org_id: organizationId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id || null,
        p_action: action,
        p_resource_type: resourceType || null,
        p_resource_id: resourceId || null,
        p_details: enrichedDetails
      });

      if (error) {
        console.error('Failed to log activity:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Activity logging error:', error);
      return null;
    }
  }, [organizationId]);

  // Convenience methods for common activities
  const logUserAction = useCallback((action: ActivityAction, details?: Record<string, any>) => {
    return logActivity({ action, resourceType: 'user', details });
  }, [logActivity]);

  const logAgentAction = useCallback((action: ActivityAction, agentId: string, details?: Record<string, any>) => {
    return logActivity({ 
      action, 
      resourceType: 'agent', 
      resourceId: agentId, 
      details 
    });
  }, [logActivity]);

  const logCallAction = useCallback((action: ActivityAction, callId: string, details?: Record<string, any>) => {
    return logActivity({ 
      action, 
      resourceType: 'call', 
      resourceId: callId, 
      details 
    });
  }, [logActivity]);

  const logMemberAction = useCallback((action: ActivityAction, memberId: string, details?: Record<string, any>) => {
    return logActivity({ 
      action, 
      resourceType: 'member', 
      resourceId: memberId, 
      details 
    });
  }, [logActivity]);

  const logOrganizationAction = useCallback((action: ActivityAction, details?: Record<string, any>) => {
    return logActivity({ 
      action, 
      resourceType: 'organization', 
      resourceId: organizationId, 
      details 
    });
  }, [logActivity, organizationId]);

  return {
    logActivity,
    logUserAction,
    logAgentAction,
    logCallAction,
    logMemberAction,
    logOrganizationAction
  };
}