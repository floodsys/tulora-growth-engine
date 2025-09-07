import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseSuperadminReturn {
  isSuperadmin: boolean;
  isLoading: boolean;
  error: string | null;
  checkSuperadmin: () => Promise<boolean>;
  invalidate: () => void;
  bootstrapSuperadmin: (token: string) => Promise<{ success: boolean; error?: string }>;
  addSuperadmin: (email: string) => Promise<{ success: boolean; error?: string }>;
  removeSuperadmin: (email: string) => Promise<{ success: boolean; error?: string }>;
}

export function useSuperadmin(): UseSuperadminReturn {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const checkSuperadmin = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.log('useSuperadmin: No user found');
      setIsSuperadmin(false);
      setIsLoading(false);
      setError(null);
      return false;
    }

    console.log('useSuperadmin: Checking superadmin status for user:', user.email, user.id);
    setIsLoading(true);
    setError(null);

    try {
      // Only use DB RPC call - no env fallbacks for authorization
      // Pass user ID explicitly to avoid auth context issues
      const { data, error } = await supabase.rpc('is_superadmin', { user_id: user.id });
      
      console.log('useSuperadmin: RPC result - data:', data, 'error:', error);
      
      if (error) {
        console.error('Error checking superadmin status:', error);
        setError(error.message);
        setIsSuperadmin(false);
      } else {
        console.log('useSuperadmin: Setting isSuperadmin to:', Boolean(data));
        setIsSuperadmin(Boolean(data));
      }
      
      setIsLoading(false);
      return Boolean(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking superadmin status:', error);
      setError(errorMessage);
      setIsSuperadmin(false);
      setIsLoading(false);
      return false;
    }
  }, [user]);

  const invalidate = useCallback(() => {
    if (user) {
      checkSuperadmin();
    }
  }, [checkSuperadmin, user]);

  // Set up auth state monitoring and window focus refetch
  useEffect(() => {
    checkSuperadmin();

    // Optional: Refetch on window focus
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
    checkSuperadmin,
    invalidate,
    bootstrapSuperadmin,
    addSuperadmin,
    removeSuperadmin,
  };
}