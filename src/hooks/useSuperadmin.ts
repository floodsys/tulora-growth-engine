import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseSuperadminReturn {
  isSuperadmin: boolean;
  isLoading: boolean;
  checkSuperadmin: () => Promise<boolean>;
  bootstrapSuperadmin: (token: string) => Promise<{ success: boolean; error?: string }>;
  addSuperadmin: (email: string) => Promise<{ success: boolean; error?: string }>;
  removeSuperadmin: (email: string) => Promise<{ success: boolean; error?: string }>;
}

export function useSuperadmin(): UseSuperadminReturn {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      checkSuperadmin();
    } else {
      setIsSuperadmin(false);
      setIsLoading(false);
    }
  }, [user]);

  // Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.
  const checkSuperadmin = async (): Promise<boolean> => {
    if (!user) {
      console.log('useSuperadmin: No user found');
      setIsSuperadmin(false);
      setIsLoading(false);
      return false;
    }

    console.log('useSuperadmin: Checking superadmin status for user:', user.email, user.id);

    try {
      // Only use DB RPC call - no env fallbacks for authorization
      const { data, error } = await supabase.rpc('is_superadmin');
      
      console.log('useSuperadmin: RPC result - data:', data, 'error:', error);
      
      if (error) {
        console.error('Error checking superadmin status:', error);
        setIsSuperadmin(false);
      } else {
        console.log('useSuperadmin: Setting isSuperadmin to:', Boolean(data));
        setIsSuperadmin(Boolean(data));
      }
      
      setIsLoading(false);
      return Boolean(data);
    } catch (error) {
      console.error('Error checking superadmin status:', error);
      setIsSuperadmin(false);
      setIsLoading(false);
      return false;
    }
  };

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
    checkSuperadmin,
    bootstrapSuperadmin,
    addSuperadmin,
    removeSuperadmin,
  };
}