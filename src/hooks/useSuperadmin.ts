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
  
  console.log('🔍 Dev check:', { isDev, hostname: window.location.hostname, env: import.meta.env.DEV });
  console.log('🔍 useSuperadmin hook initialized');

  const checkSuperadmin = useCallback(async (): Promise<void> => {
    // Development bypass
    if (isDev) {
      setIsSuperadmin(true);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!user) {
      setIsSuperadmin(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Prevent multiple simultaneous calls
    if (isLoading) return;

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
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking superadmin status:', error);
      setError(errorMessage);
      setIsSuperadmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [user, isDev, isLoading]);

  // Expose refresh function
  const refresh = useCallback(async () => {
    await checkSuperadmin();
  }, [checkSuperadmin]);

  // Set up auth state monitoring - only check once when user changes
  useEffect(() => {
    if (user) {
      checkSuperadmin();
    } else {
      setIsSuperadmin(false);
      setIsLoading(false);
      setError(null);
    }
  }, [user?.id]); // Only trigger when user ID changes, not the whole user object

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