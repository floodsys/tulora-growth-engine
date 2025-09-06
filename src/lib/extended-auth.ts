import { supabase } from "@/integrations/supabase/client";

const EXTENDED_SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export const handleExtendedAuth = async (email: string, password: string, stayLoggedIn: boolean) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return { data, error };
  }

  if (stayLoggedIn) {
    // Store extended session preference in localStorage
    const extendedSessionData = {
      enabled: true,
      timestamp: Date.now(),
      expiresAt: Date.now() + EXTENDED_SESSION_DURATION,
    };
    
    localStorage.setItem('extended_session', JSON.stringify(extendedSessionData));
    
    // Also store in user metadata for server-side tracking
    await supabase.auth.updateUser({
      data: { 
        extended_session: true,
        extended_session_expires: new Date(Date.now() + EXTENDED_SESSION_DURATION).toISOString()
      }
    });
  } else {
    // Remove extended session if not requested
    localStorage.removeItem('extended_session');
    await supabase.auth.updateUser({
      data: { 
        extended_session: false,
        extended_session_expires: null
      }
    });
  }

  return { data, error };
};

export const checkExtendedSession = () => {
  const extendedSession = localStorage.getItem('extended_session');
  if (!extendedSession) return false;

  try {
    const sessionData = JSON.parse(extendedSession);
    return sessionData.enabled && Date.now() < sessionData.expiresAt;
  } catch {
    localStorage.removeItem('extended_session');
    return false;
  }
};

export const clearExtendedSession = () => {
  localStorage.removeItem('extended_session');
};