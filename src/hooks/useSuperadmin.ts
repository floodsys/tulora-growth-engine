import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseSuperadminReturn {
  isSuperadmin: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  bootstrapSuperadmin: (token: string) => Promise<{ success: boolean; error?: string }>;
  addSuperadmin: (email: string) => Promise<{ success: boolean; error?: string }>;
  removeSuperadmin: (email: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Normalize RPC return value to boolean
 * Handles various Postgres boolean representations
 */
function normalizeBooleanResult(data: any): boolean {
  if (data === true || data === 't' || data === 'true') return true;
  if (data === false || data === 'f' || data === 'false') return false;
  if (data?.is_superadmin === true) return true;
  if (Array.isArray(data) && data[0]?.is_superadmin === true) return true;
  return false;
}

export function useSuperadmin(): UseSuperadminReturn {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Check if we're in development mode (including Lovable preview)
  const isDev = import.meta.env.DEV || 
                window.location.hostname === 'localhost' ||
                window.location.hostname.includes('lovable.app');

  const checkSuperadmin = useCallback(async (): Promise<void> => {
    // Development bypass
    if (isDev) {
      setIsSuperadmin(true);
      setIsLoading(false);
      setError(null);
      console.log('[useSuperadmin] Development mode - bypassing superadmin checks');
      return;
    }

    if (!user) {
      setIsSuperadmin(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('is_superadmin', { 
        user_id: user.id 
      });
      
      if (rpcError) {
        console.error('RPC error checking superadmin status:', rpcError);
        setError(rpcError.message);
        setIsSuperadmin(false);
        return;
      }

      const result = normalizeBooleanResult(data);
      setIsSuperadmin(result);

      // Structured observability log (minimal, no PII beyond ID)
      const logData = {
        where: "UI",
        user_id: user.id,
        isSuperadmin: result,
        raw_data: data,
        ts: new Date().toISOString()
      };
      console.log('🔐 Superadmin Check:', JSON.stringify(logData));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking superadmin status:', error);
      setError(errorMessage);
      setIsSuperadmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [user, isDev]);

  // Expose refresh function
  const refresh = useCallback(async () => {
    await checkSuperadmin();
  }, [checkSuperadmin]);

  // Set up auth state monitoring
  useEffect(() => {
    checkSuperadmin();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        checkSuperadmin();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkSuperadmin]);

  // Optional: Refetch on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (user && !isLoading) {
        checkSuperadmin();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkSuperadmin, user, isLoading]);

  const bootstrapSuperadmin = async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('bootstrap_superadmin', {
        p_bootstrap_token: token
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as any;
      if (result?.success) {
        setIsSuperadmin(true);
        return { success: true };
      } else {
        return { success: false, error: result?.error || 'Bootstrap failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };

  const addSuperadmin = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('add_superadmin', {
        p_user_email: email
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as any;
      if (result?.success) {
        return { success: true };
      } else {
        return { success: false, error: result?.error || 'Failed to add superadmin' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };

  const removeSuperadmin = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('remove_superadmin', {
        p_user_email: email
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as any;
      if (result?.success) {
        return { success: true };
      } else {
        return { success: false, error: result?.error || 'Failed to remove superadmin' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };

  return {
    isSuperadmin,
    isLoading,
    error,
    refresh,
    bootstrapSuperadmin,
    addSuperadmin,
    removeSuperadmin,
  };
}