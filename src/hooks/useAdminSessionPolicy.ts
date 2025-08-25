import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { supabase } from '@/integrations/supabase/client';

const SUPERADMIN_SESSION_MAX_HOURS = 12;
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

export function useAdminSessionPolicy() {
  const { user, session } = useAuth();
  const { isSuperadmin } = useSuperadmin();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());

  const checkSessionAge = useCallback(() => {
    if (!session || !isSuperadmin) {
      setSessionExpired(false);
      return;
    }

    // Get session creation time from JWT
    const sessionCreatedAt = session.user?.created_at 
      ? new Date(session.user.created_at).getTime()
      : new Date().getTime();

    const now = Date.now();
    const sessionAgeHours = (now - sessionCreatedAt) / (1000 * 60 * 60);

    if (sessionAgeHours > SUPERADMIN_SESSION_MAX_HOURS) {
      setSessionExpired(true);
      // Log the session expiry
      logAdminSessionEvent('admin.session_expired', {
        session_age_hours: sessionAgeHours,
        max_allowed_hours: SUPERADMIN_SESSION_MAX_HOURS
      });
    } else {
      setSessionExpired(false);
    }

    setLastCheckTime(now);
  }, [session, isSuperadmin]);

  const forceReLogin = useCallback(async () => {
    if (session && isSuperadmin) {
      // Log forced logout
      await logAdminSessionEvent('admin.forced_logout', {
        reason: 'session_expired',
        session_age_hours: SUPERADMIN_SESSION_MAX_HOURS
      });
      
      // Sign out and force re-authentication
      await supabase.auth.signOut();
      setSessionExpired(false);
    }
  }, [session, isSuperadmin]);

  const logAdminSessionEvent = useCallback(async (action: string, metadata: any = {}) => {
    try {
      await supabase.rpc('log_event', {
        p_org_id: '00000000-0000-0000-0000-000000000000',
        p_action: action,
        p_target_type: 'admin_session',
        p_actor_user_id: user?.id,
        p_actor_role_snapshot: 'superadmin',
        p_metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          session_enforcement: true
        },
        p_channel: 'internal'
      });
    } catch (error) {
      console.error('Failed to log admin session event:', error);
    }
  }, [user?.id]);

  // Check session age on mount and periodically
  useEffect(() => {
    checkSessionAge();
    
    const interval = setInterval(() => {
      checkSessionAge();
    }, SESSION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkSessionAge]);

  // Check when superadmin status changes
  useEffect(() => {
    if (isSuperadmin) {
      checkSessionAge();
    } else {
      setSessionExpired(false);
    }
  }, [isSuperadmin, checkSessionAge]);

  return {
    sessionExpired,
    sessionAgeHours: session ? (Date.now() - new Date(session.user?.created_at || 0).getTime()) / (1000 * 60 * 60) : 0,
    maxAllowedHours: SUPERADMIN_SESSION_MAX_HOURS,
    forceReLogin,
    lastCheckTime
  };
}