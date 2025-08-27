import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminSession {
  valid: boolean;
  issued_at?: string;
  age_minutes?: number;
  max_age_minutes?: number;
  ttl_minutes?: number;
  reason?: string;
  last_validate_time?: string;
  validate_endpoint?: string;
  cookie_present?: boolean;
}

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  const checkSession = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('admin-step-up-auth', {
        body: { action: 'check_session' }
      });

      if (error) throw error;
      
      // Add validation metadata
      const sessionWithMeta = {
        ...data,
        last_validate_time: new Date().toISOString(),
        validate_endpoint: '/functions/v1/admin-step-up-auth',
        cookie_present: data.valid // If session is valid, cookie was present
      };
      
      setSession(sessionWithMeta);
    } catch (error) {
      console.error('Error checking admin session:', error);
      setSession({ 
        valid: false, 
        reason: 'Check failed',
        last_validate_time: new Date().toISOString(),
        validate_endpoint: '/functions/v1/admin-step-up-auth',
        cookie_present: false
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyStepUp = async () => {
    try {
      setVerifying(true);
      const { data, error } = await supabase.functions.invoke('admin-step-up-auth', {
        body: { action: 'verify_step_up' }
      });

      if (error) throw error;

      toast({
        title: "Admin session elevated",
        description: "Step-up authentication successful",
      });

      // Refresh session status and force component re-render
      await checkSession();
      
      // Force refresh any cached state by clearing relevant localStorage
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('admin') || key.includes('step_up') || key.includes('issued_at')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      return true;
    } catch (error) {
      console.error('Error verifying step-up:', error);
      toast({
        title: "Step-up authentication failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const clearSession = async () => {
    try {
      const { error } = await supabase.functions.invoke('admin-step-up-auth', {
        body: { action: 'clear_session' }
      });

      if (error) throw error;

      toast({
        title: "Admin session cleared",
        description: "Elevated session has been terminated",
      });

      await checkSession();
    } catch (error) {
      console.error('Error clearing session:', error);
      toast({
        title: "Error clearing session",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const hardRefreshCache = async () => {
    try {
      // Clear localStorage keys used for admin session
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('admin') || key.includes('step_up') || key.includes('issued_at')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // Clear all caches for this origin
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      toast({
        title: "Cache cleared",
        description: "Page will reload to apply changes",
      });

      // Reload page after a brief delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: "Error clearing cache",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    checkSession();
    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    session,
    loading,
    verifying,
    checkSession,
    verifyStepUp,
    clearSession,
    hardRefreshCache
  };
}