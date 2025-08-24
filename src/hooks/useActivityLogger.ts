import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from './useUserOrganization';

// Canonical event taxonomy
export type AuditAction = 
  // Authentication & Session
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  
  // Organization Management
  | 'org.created'
  | 'org.updated'
  | 'org.deleted'
  | 'org.settings_changed'
  
  // Member Management
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'member.role_changed'
  | 'member.deactivated'
  | 'member.reactivated'
  
  // Invitation Management
  | 'invite.created'
  | 'invite.accepted'
  | 'invite.declined'
  | 'invite.revoked'
  | 'invite.expired'
  
  // Agent Management
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'agent.activated'
  | 'agent.deactivated'
  | 'agent.published'
  | 'agent.unpublished'
  
  // Billing & Subscriptions
  | 'billing.plan_updated'
  | 'billing.payment_method_added'
  | 'billing.payment_method_removed'
  | 'billing.invoice_generated'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'subscription.renewed'
  | 'subscription.downgraded'
  | 'subscription.upgraded'
  
  // Integrations & API
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.config_changed'
  | 'api_key.created'
  | 'api_key.deleted'
  | 'api_key.rotated'
  
  // File & Content Management
  | 'file.uploaded'
  | 'file.deleted'
  | 'file.accessed'
  | 'file.shared';

export type InternalAction =
  // System Events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error'
  | 'system.maintenance_start'
  | 'system.maintenance_end'
  
  // Performance & Diagnostics
  | 'perf.slow_query'
  | 'perf.high_cpu'
  | 'perf.high_memory'
  | 'internal.debug_enabled'
  | 'internal.feature_flag_changed'
  
  // Call Operations (Internal tracking)
  | 'call.initiated_internal'
  | 'call.connected_internal'
  | 'call.completed_internal'
  | 'call.failed_internal'
  | 'call.webhook_received'
  
  // Data Processing
  | 'data.export_started'
  | 'data.export_completed'
  | 'data.cleanup_started'
  | 'data.cleanup_completed';

export type TestAction =
  // Test-specific actions (from test suite)
  | 'test.invite_created'
  | 'test.invite_accepted'
  | 'test.member_role_updated'
  | 'test.data_integrity_check'
  | 'test.permission_check'
  | 'test.rls_validation';

export type AllActions = AuditAction | InternalAction | TestAction;

export type TargetType = 
  | 'agent'
  | 'member' 
  | 'invite'
  | 'org'
  | 'integration'
  | 'subscription'
  | 'api_key'
  | 'file'
  | 'test'
  | 'other';

export type ActorRole = 'admin' | 'editor' | 'viewer' | 'user' | 'system';

export type EventChannel = 'audit' | 'internal' | 'test_invites';

export type EventStatus = 'success' | 'error';

interface ActivityEventData {
  action: AllActions;
  targetType: TargetType;
  targetId?: string;
  channel?: EventChannel;
  status?: EventStatus;
  errorCode?: string;
  metadata?: Record<string, any>;
}

// Enhanced activity logger with canonical taxonomy
export function useActivityLogger() {
  const { organizationId } = useUserOrganization();

  const logEvent = useCallback(async ({
    action,
    targetType,
    targetId,
    channel = 'audit',
    status = 'success',
    errorCode,
    metadata = {}
  }: ActivityEventData) => {
    if (!organizationId) {
      console.warn('Cannot log activity: No organization context');
      return null;
    }

    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user's role in the organization
      let actorRole: ActorRole = 'user';
      if (user) {
        const { data: roleData } = await supabase.rpc('get_user_org_role', {
          p_org_id: organizationId,
          p_user_id: user.id
        });
        actorRole = (roleData as ActorRole) || 'user';
      }

      // Generate request ID for tracing
      const requestId = crypto.randomUUID();
      
      // Get request context (privacy-conscious)
      const userAgent = navigator.userAgent;
      const ipHash = await hashIP(); // We'll implement this
      const trimmedUserAgent = trimUserAgent(userAgent);
      
      // Enhanced metadata with context
      const enrichedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        url: window.location.pathname,
        userAgent: trimmedUserAgent,
        ...(status === 'error' && errorCode && { errorCode }),
      };

      // Log via database function
      const { data, error } = await supabase.rpc('log_activity_event', {
        p_org_id: organizationId,
        p_action: action,
        p_target_type: targetType,
        p_actor_user_id: user?.id || null,
        p_actor_role_snapshot: actorRole,
        p_target_id: targetId || null,
        p_status: status,
        p_error_code: errorCode || null,
        p_ip_hash: ipHash,
        p_user_agent: trimmedUserAgent,
        p_request_id: requestId,
        p_channel: channel,
        p_metadata: enrichedMetadata
      });

      if (error) {
        console.error('Failed to log activity event:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Activity logging error:', error);
      return null;
    }
  }, [organizationId]);

  // Convenience methods for different channels
  const logAuditEvent = useCallback((data: Omit<ActivityEventData, 'channel'>) => {
    return logEvent({ ...data, channel: 'audit' });
  }, [logEvent]);

  const logInternalEvent = useCallback((data: Omit<ActivityEventData, 'channel'>) => {
    return logEvent({ ...data, channel: 'internal' });
  }, [logEvent]);

  const logTestEvent = useCallback((data: Omit<ActivityEventData, 'channel'>) => {
    return logEvent({ ...data, channel: 'test_invites' });
  }, [logEvent]);

  // Convenience methods for common audit events
  const logMemberAction = useCallback((action: AuditAction, memberId: string, metadata?: Record<string, any>) => {
    return logAuditEvent({ 
      action, 
      targetType: 'member', 
      targetId: memberId, 
      metadata 
    });
  }, [logAuditEvent]);

  const logAgentAction = useCallback((action: AuditAction, agentId: string, metadata?: Record<string, any>) => {
    return logAuditEvent({ 
      action, 
      targetType: 'agent', 
      targetId: agentId, 
      metadata 
    });
  }, [logAuditEvent]);

  const logInviteAction = useCallback((action: AuditAction, inviteId: string, metadata?: Record<string, any>) => {
    return logAuditEvent({ 
      action, 
      targetType: 'invite', 
      targetId: inviteId, 
      metadata 
    });
  }, [logAuditEvent]);

  const logOrgAction = useCallback((action: AuditAction, metadata?: Record<string, any>) => {
    return logAuditEvent({ 
      action, 
      targetType: 'org', 
      targetId: organizationId, 
      metadata 
    });
  }, [logAuditEvent, organizationId]);

  const logBillingAction = useCallback((action: AuditAction, targetId?: string, metadata?: Record<string, any>) => {
    return logAuditEvent({ 
      action, 
      targetType: 'subscription', 
      targetId, 
      metadata 
    });
  }, [logAuditEvent]);

  return {
    logEvent,
    logAuditEvent,
    logInternalEvent,
    logTestEvent,
    logMemberAction,
    logAgentAction,
    logInviteAction,
    logOrgAction,
    logBillingAction
  };
}

// Helper functions for privacy-conscious data handling
async function hashIP(): Promise<string | null> {
  try {
    // We can't get the real IP on frontend, so we'll use a placeholder
    // The real IP hashing happens on the server side
    return null;
  } catch {
    return null;
  }
}

function trimUserAgent(userAgent: string): string {
  if (!userAgent) return '';
  
  // Take first 100 characters and remove potentially sensitive tokens
  let trimmed = userAgent.substring(0, 100);
  
  // Remove common sensitive patterns
  trimmed = trimmed.replace(/\b[a-zA-Z0-9]{20,}\b/g, '[TOKEN]');
  trimmed = trimmed.replace(/Bearer\s+[^\s]+/gi, 'Bearer [TOKEN]');
  
  return trimmed;
}