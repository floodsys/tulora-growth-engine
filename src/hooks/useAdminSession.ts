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
      
      // Call the admin validation edge function
      const { data, error } = await supabase.functions.invoke('admin-validate', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message || 'Validation failed');
      }

      
      // Add validation metadata (handle both age_minutes and age_sec for backward compatibility)
      const sessionWithMeta = {
        ...data,
        age_minutes: data.age_sec ? Math.floor(data.age_sec / 60) : data.age_minutes,
        ttl_minutes: data.ttl_sec ? Math.floor(data.ttl_sec / 60) : data.ttl_minutes,
        last_validate_time: new Date().toISOString(),
        validate_endpoint: 'admin-validate',
        cookie_present: data.cookie_present || data.valid // Use explicit flag or infer from validity
      };
      
      setSession(sessionWithMeta);
    } catch (error) {
      console.error('Error checking admin session:', error);
      setSession({ 
        valid: false, 
        reason: 'Check failed',
        last_validate_time: new Date().toISOString(),
        validate_endpoint: 'admin-validate',
        cookie_present: false
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyStepUp = async () => {
    try {
      setVerifying(true);
      
      // Call the admin step-up edge function
      const { data, error } = await supabase.functions.invoke('admin-step-up-test', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message || 'Step-up failed');
      }

      toast({
        title: "Admin session elevated",
        description: "Step-up authentication successful",
      });

      // Store the step-up time in localStorage as a simpler approach
      localStorage.setItem('admin_step_up_time', Date.now().toString());

      // Force refresh any cached state by clearing relevant localStorage
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('admin') || key.includes('step_up') || key.includes('issued_at')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Small delay to ensure cookie is set before checking
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh session status after successful step-up
      await checkSession();
      
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
      // Use same-origin API call to clear session (not implemented yet, but can be added)
      // For now, just clear on client side and check session
      
      // Clear any local state
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('admin') || key.includes('step_up') || key.includes('issued_at')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      toast({
        title: "Admin session cleared",
        description: "Local session state cleared",
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

  const testStepUp = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-step-up-test', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message || 'Test failed');
      }
      
      toast({
        title: "Test step-up successful", 
        description: "Headless test endpoint set elevated cookie",
      });
      
      // Small delay then check session
      await new Promise(resolve => setTimeout(resolve, 500));
      await checkSession();
      return true;
    } catch (error) {
      console.error('Test step-up error:', error);
      toast({
        title: "Test step-up failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    session,
    loading,
    verifying,
    checkSession,
    verifyStepUp,
    clearSession,
    hardRefreshCache,
    testStepUp
  };
}